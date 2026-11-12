//! Windows implementations.

use tauri::{AppHandle, Runtime};

/// Hiding the focused popup lets Windows activate the next window in z-order,
/// which is normally the app the user came from. Nothing extra for now.
// TODO(windows-test): verify focus returns to the previous app.
pub fn restore_previous_app<R: Runtime>(_app: &AppHandle<R>) {}
