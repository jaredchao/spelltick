//! macOS implementations.

use tauri::{AppHandle, Runtime};

/// Deactivate this app so macOS re-activates the app the user was in before.
/// `NSApp.hide` hides every window of this app; the popup is already hidden.
// TODO(M4): once the settings window exists, avoid hiding it here.
pub fn restore_previous_app<R: Runtime>(app: &AppHandle<R>) {
    if let Err(e) = app.hide() {
        eprintln!("[platform] failed to hide app: {e}");
    }
}
