//! The `settings` window (SPEC 2.2): a normal window opened from the tray.

use tauri::{AppHandle, Manager, Runtime, WebviewUrl, WebviewWindowBuilder};

pub const LABEL: &str = "settings";

/// Show the settings window, creating it on first use.
pub fn open<R: Runtime>(app: &AppHandle<R>) {
    if let Some(win) = app.get_webview_window(LABEL) {
        let _ = win.unminimize();
        let _ = win.show();
        let _ = win.set_focus();
        return;
    }
    let built = WebviewWindowBuilder::new(app, LABEL, WebviewUrl::App("index.html".into()))
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
pub fn settings_window_open<R: Runtime>(app: AppHandle<R>) {
    open(&app);
}
