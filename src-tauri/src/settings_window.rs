//! The `settings` window (SPEC 2.2): a normal window opened from the tray.

use tauri::{AppHandle, Emitter, Manager, Runtime, WebviewUrl, WebviewWindowBuilder};

pub const LABEL: &str = "settings";
/// Ask an open settings window to switch to a tab (payload: tab id).
pub const EVENT_TAB: &str = "settings://tab";

/// Show the settings window, creating it on first use. `tab` selects the
/// page to show, e.g. "history".
pub fn open<R: Runtime>(app: &AppHandle<R>, tab: Option<&str>) {
    if let Some(win) = app.get_webview_window(LABEL) {
        let _ = win.unminimize();
        let _ = win.show();
        let _ = win.set_focus();
        if let Some(tab) = tab {
            let _ = app.emit_to(LABEL, EVENT_TAB, tab);
        }
        return;
    }
    let url = match tab {
        Some(tab) => format!("index.html?tab={tab}"),
        None => "index.html".into(),
    };
    let built = WebviewWindowBuilder::new(app, LABEL, WebviewUrl::App(url.into()))
        .title("设置")
        .inner_size(820.0, 624.0)
        .min_inner_size(720.0, 560.0)
        .center()
        .focused(true)
        .build();
    match built {
        Ok(win) => {
            let _ = win.set_focus();
        }
        Err(e) => eprintln!("[settings] failed to open window: {e}"),
    }
}

#[tauri::command]
pub fn settings_window_open<R: Runtime>(app: AppHandle<R>, tab: Option<String>) {
    open(&app, tab.as_deref());
}
