//! The `popup` window: created hidden at startup, shown without stealing focus.
//!
//! Focus rules (see CLAUDE.md, "most important rule"):
//! - `popup_show_peek` keeps the window non-focusable, so `show()` only orders it
//!   to the front. Keystrokes keep going to the app the user is typing in.
//! - Only `popup_focus` (user pressed the hotkey or clicked the card) makes it
//!   focusable and calls `set_focus()`.
//! - `popup_hide` makes it non-focusable again and hands focus back.

use tauri::{
    AppHandle, Emitter, LogicalSize, Manager, PhysicalPosition, Runtime, WebviewUrl, WebviewWindow,
    WebviewWindowBuilder,
};

use crate::geometry::{self, Rect};

pub const LABEL: &str = "popup";

/// Hotkey or tray "next question": the frontend decides what to do by phase.
pub const EVENT_SUMMON: &str = "popup://summon";
/// Debug-only trigger that shows the non-focused peek state.
#[cfg(debug_assertions)]
pub const EVENT_PEEK: &str = "popup://peek";

/// Distance between the card edge and the work-area edge, in logical px.
const SCREEN_GAP: f64 = 24.0;

pub fn create<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<WebviewWindow<R>> {
    WebviewWindowBuilder::new(app, LABEL, WebviewUrl::App("index.html".into()))
        .title("英语拼写")
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
}

fn window<R: Runtime>(app: &AppHandle<R>) -> Result<WebviewWindow<R>, String> {
    app.get_webview_window(LABEL)
        .ok_or_else(|| "popup window not found".to_string())
}

fn err(e: tauri::Error) -> String {
    e.to_string()
}

/// Resize the window to `width` x `height` (logical) and anchor it to the
/// bottom-right of the primary monitor's work area. `inset` is the transparent
/// padding around the card inside the window, so the card itself sits
/// `SCREEN_GAP` away from the screen edge.
#[tauri::command]
pub fn popup_place<R: Runtime>(
    app: AppHandle<R>,
    width: f64,
    height: f64,
    inset: f64,
) -> Result<(), String> {
    let win = window(&app)?;
    let monitor = win
        .primary_monitor()
        .map_err(err)?
        .ok_or_else(|| "no primary monitor".to_string())?;

    let scale = monitor.scale_factor();
    let work = monitor.work_area();
    let area = Rect {
        x: work.position.x,
        y: work.position.y,
        width: work.size.width,
        height: work.size.height,
    };
    let size_px = (
        (width * scale).round() as u32,
        (height * scale).round() as u32,
    );
    let gap_px = ((SCREEN_GAP - inset).max(0.0) * scale).round() as u32;
    let (x, y) = geometry::bottom_right(area, size_px, gap_px);
    win.set_size(LogicalSize::new(width, height)).map_err(err)?;
    win.set_position(PhysicalPosition::new(x, y)).map_err(err)?;
    Ok(())
}

/// Show without taking focus.
#[tauri::command]
pub fn popup_show_peek<R: Runtime>(app: AppHandle<R>) -> Result<(), String> {
    let win = window(&app)?;
    win.set_focusable(false).map_err(err)?;
    win.show().map_err(err)
}

/// Show and take focus. Only call on explicit user action.
#[tauri::command]
pub fn popup_focus<R: Runtime>(app: AppHandle<R>) -> Result<(), String> {
    let win = window(&app)?;
    win.set_focusable(true).map_err(err)?;
    win.show().map_err(err)?;
    win.set_focus().map_err(err)
}

/// Hide and return focus to the previously active app.
#[tauri::command]
pub fn popup_hide<R: Runtime>(app: AppHandle<R>) -> Result<(), String> {
    let win = window(&app)?;
    let had_focus = win.is_focused().unwrap_or(false);
    win.hide().map_err(err)?;
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
        if let Err(e) = app.emit_to(LABEL, EVENT_PEEK, ()) {
            eprintln!("[popup] failed to emit peek: {e}");
        }
    });
}
