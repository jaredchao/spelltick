//! The `popup` window: created hidden at startup, shown without stealing focus.
//!
//! Focus rules (see CLAUDE.md, "most important rule"):
//! - `popup_show_peek` keeps the window non-focusable, so `show()` only orders it
//!   to the front. Keystrokes keep going to the app the user is typing in.
//! - Only `popup_focus` (user pressed the hotkey or clicked the card) makes it
//!   focusable and calls `set_focus()`.
//! - `popup_hide` makes it non-focusable again and hands focus back.
//!
//! Position: bottom-right of the primary work area until the user drags the
//! card; after that its bottom-right corner stays where it was dropped (for
//! the rest of this run), so cards grow up and to the left from there.

use tauri::{
    AppHandle, Emitter, LogicalSize, Manager, Monitor, PhysicalPosition, Runtime, WebviewUrl,
    WebviewWindow, WebviewWindowBuilder, WindowEvent,
};

use std::sync::{
    Mutex,
    atomic::{AtomicBool, Ordering},
};

use crate::geometry::{self, Rect};

static VISIBLE: AtomicBool = AtomicBool::new(false);

/// Where the user dropped the card (bottom-right corner, physical px), plus the
/// last positions we set ourselves so our own moves are not taken for drags.
struct Placement {
    anchor: Option<(i32, i32)>,
    recent: [Option<(i32, i32)>; 2],
}

static PLACEMENT: Mutex<Placement> = Mutex::new(Placement {
    anchor: None,
    recent: [None, None],
});

fn placement() -> std::sync::MutexGuard<'static, Placement> {
    PLACEMENT.lock().unwrap_or_else(|p| p.into_inner())
}

fn near(a: (i32, i32), b: (i32, i32)) -> bool {
    (a.0 - b.0).abs() <= 2 && (a.1 - b.1).abs() <= 2
}

/// A move we did not make ourselves is a user drag: remember the new corner.
fn on_moved(position: (i32, i32), size: (u32, u32)) {
    let mut p = placement();
    if p.recent.iter().flatten().any(|&r| near(r, position)) {
        return;
    }
    p.anchor = Some((position.0 + size.0 as i32, position.1 + size.1 as i32));
}

fn work_rect(monitor: &Monitor) -> Rect {
    let work = monitor.work_area();
    Rect {
        x: work.position.x,
        y: work.position.y,
        width: work.size.width,
        height: work.size.height,
    }
}

/// Whether the popup is on screen (any phase). The scheduler never fires while it is.
pub fn is_visible() -> bool {
    VISIBLE.load(Ordering::SeqCst)
}

pub const LABEL: &str = "popup";

/// Hotkey or tray "next question": the frontend decides what to do by phase.
pub const EVENT_SUMMON: &str = "popup://summon";
/// Scheduler (or debug) trigger that shows the non-focused peek state.
pub const EVENT_PEEK: &str = "popup://peek";

#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct PeekPayload {
    /// Ask this item again (a peek that timed out earlier), else pick a new one.
    item_id: Option<i64>,
}

/// Distance between the card edge and the work-area edge, in logical px.
const SCREEN_GAP: f64 = 24.0;

pub fn create<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<WebviewWindow<R>> {
    WebviewWindowBuilder::new(app, LABEL, WebviewUrl::App("index.html".into()))
        .title("拼刻 Spelltick")
        .inner_size(260.0, 56.0)
        .decorations(false)
        .transparent(true)
        .shadow(false)
        .resizable(false)
        .always_on_top(true)
        .skip_taskbar(true)
        .visible_on_all_workspaces(true)
        .visible(false)
        .focused(false)
        .focusable(false)
        .accept_first_mouse(true)
        .build()
        .inspect(|win| {
            let handle = win.clone();
            win.on_window_event(move |event| {
                if let WindowEvent::Moved(pos) = event
                    && let Ok(size) = handle.outer_size()
                {
                    on_moved((pos.x, pos.y), (size.width, size.height));
                }
            });
        })
}

fn window<R: Runtime>(app: &AppHandle<R>) -> Result<WebviewWindow<R>, String> {
    app.get_webview_window(LABEL)
        .ok_or_else(|| "popup window not found".to_string())
}

fn err(e: tauri::Error) -> String {
    e.to_string()
}

/// Resize the window to `width` x `height` (logical) and position it: at the
/// user's drop point if they dragged the card, else bottom-right of the primary
/// work area. `inset` is the transparent padding around the card inside the
/// window, so the card itself sits `SCREEN_GAP` away from the screen edge.
#[tauri::command]
pub fn popup_place<R: Runtime>(
    app: AppHandle<R>,
    width: f64,
    height: f64,
    inset: f64,
) -> Result<(), String> {
    let win = window(&app)?;
    let anchor = placement().anchor;
    let monitors = win.available_monitors().map_err(err)?;
    let anchored_monitor = anchor.and_then(|(ax, ay)| {
        monitors
            .iter()
            .find(|m| geometry::contains(work_rect(m), (ax - 1, ay - 1)))
            .cloned()
    });
    let use_anchor = anchored_monitor.is_some();
    let monitor = match anchored_monitor {
        Some(m) => m,
        None => win
            .primary_monitor()
            .map_err(err)?
            .ok_or_else(|| "no primary monitor".to_string())?,
    };

    let scale = monitor.scale_factor();
    let area = work_rect(&monitor);
    let size_px = (
        (width * scale).round() as u32,
        (height * scale).round() as u32,
    );
    let (x, y) = match (anchor, use_anchor) {
        (Some(a), true) => geometry::at_anchor(area, a, size_px),
        _ => {
            let gap_px = ((SCREEN_GAP - inset).max(0.0) * scale).round() as u32;
            geometry::bottom_right(area, size_px, gap_px)
        }
    };
    {
        let mut p = placement();
        p.recent = [Some((x, y)), p.recent[0]];
    }
    // Position first: a resize keeps the top-left, so its move event matches.
    win.set_position(PhysicalPosition::new(x, y)).map_err(err)?;
    win.set_size(LogicalSize::new(width, height)).map_err(err)?;
    Ok(())
}

/// Show without taking focus.
#[tauri::command]
pub fn popup_show_peek<R: Runtime>(app: AppHandle<R>) -> Result<(), String> {
    let win = window(&app)?;
    win.set_focusable(false).map_err(err)?;
    win.show().map_err(err)?;
    VISIBLE.store(true, Ordering::SeqCst);
    Ok(())
}

/// Show and take focus. Only call on explicit user action.
#[tauri::command]
pub fn popup_focus<R: Runtime>(app: AppHandle<R>) -> Result<(), String> {
    let win = window(&app)?;
    crate::platform::remember_frontmost_app();
    win.set_focusable(true).map_err(err)?;
    win.show().map_err(err)?;
    VISIBLE.store(true, Ordering::SeqCst);
    win.set_focus().map_err(err)
}

/// Hide and return focus to the previously active app.
#[tauri::command]
pub fn popup_hide<R: Runtime>(app: AppHandle<R>) -> Result<(), String> {
    let win = window(&app)?;
    let had_focus = win.is_focused().unwrap_or(false);
    win.hide().map_err(err)?;
    VISIBLE.store(false, Ordering::SeqCst);
    win.set_focusable(false).map_err(err)?;
    if had_focus {
        crate::platform::restore_previous_app(&app);
    }
    Ok(())
}

pub fn summon<R: Runtime>(app: &AppHandle<R>) {
    if let Err(e) = app.emit_to(LABEL, EVENT_SUMMON, ()) {
        eprintln!("[popup] failed to emit summon: {e}");
    }
}

/// Debug helper: show the peek state after `delay` so the tester can switch
/// back to an editor and keep typing.
#[cfg(debug_assertions)]
pub fn peek_after<R: Runtime>(app: &AppHandle<R>, delay: std::time::Duration) {
    let app = app.clone();
    std::thread::spawn(move || {
        std::thread::sleep(delay);
        peek(&app, None);
    });
}

/// Ask the frontend to show the peek state (it loads the question first).
pub fn peek<R: Runtime>(app: &AppHandle<R>, item_id: Option<i64>) {
    if let Err(e) = app.emit_to(LABEL, EVENT_PEEK, PeekPayload { item_id }) {
        eprintln!("[popup] failed to emit peek: {e}");
    }
}
