//! Platform-specific integrations (focus hand-back, and later fullscreen
//! detection, idle time, keychain, selected text). macOS and Windows live in
//! separate modules.

#[cfg(target_os = "macos")]
mod macos;
#[cfg(target_os = "macos")]
pub use macos::restore_previous_app;

#[cfg(target_os = "windows")]
mod windows;
#[cfg(target_os = "windows")]
pub use windows::restore_previous_app;

#[cfg(not(any(target_os = "macos", target_os = "windows")))]
pub fn restore_previous_app<R: tauri::Runtime>(_app: &tauri::AppHandle<R>) {}
