//! Remember which app was frontmost before the popup took focus, and hand
//! focus back to it afterwards.

use std::sync::atomic::{AtomicI32, Ordering};

use objc2_app_kit::{NSApplicationActivationOptions, NSRunningApplication, NSWorkspace};
use tauri::{AppHandle, Manager, Runtime};

static PREVIOUS_PID: AtomicI32 = AtomicI32::new(-1);

fn own_pid() -> i32 {
    std::process::id() as i32
}

/// Call right before the popup takes focus.
pub fn remember_frontmost_app() {
    let workspace = NSWorkspace::sharedWorkspace();
    if let Some(app) = workspace.frontmostApplication() {
        let pid = app.processIdentifier();
        if pid > 0 && pid != own_pid() {
            PREVIOUS_PID.store(pid, Ordering::SeqCst);
        }
    }
}

/// Re-activate the remembered app. Without one, hide this app unless the
/// settings window is open (hiding would close it from view).
pub fn restore_previous_app<R: Runtime>(app: &AppHandle<R>) {
    let pid = PREVIOUS_PID.swap(-1, Ordering::SeqCst);
    if pid > 0
        && let Some(running) = NSRunningApplication::runningApplicationWithProcessIdentifier(pid)
    {
        #[allow(deprecated)]
        let activated = running.activateWithOptions(NSApplicationActivationOptions::empty());
        if activated {
            return;
        }
    }
    let settings_visible = app
        .get_webview_window(crate::settings_window::LABEL)
        .and_then(|w| w.is_visible().ok())
        .unwrap_or(false);
    if !settings_visible && let Err(e) = app.hide() {
        eprintln!("[platform] failed to hide app: {e}");
    }
}
