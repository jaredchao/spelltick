//! Platform-specific integrations. macOS and Windows live in separate modules
//! and expose the same functions.

#[cfg(target_os = "macos")]
mod macos;
#[cfg(target_os = "macos")]
pub use macos::{is_fullscreen_app_active, restore_previous_app, seconds_since_last_input};

#[cfg(target_os = "windows")]
mod windows;
#[cfg(target_os = "windows")]
pub use windows::{is_fullscreen_app_active, restore_previous_app, seconds_since_last_input};

#[cfg(not(any(target_os = "macos", target_os = "windows")))]
mod fallback {
    pub fn restore_previous_app<R: tauri::Runtime>(_app: &tauri::AppHandle<R>) {}
    pub fn is_fullscreen_app_active() -> bool {
        false
    }
    pub fn seconds_since_last_input() -> f64 {
        f64::MAX
    }
}
#[cfg(not(any(target_os = "macos", target_os = "windows")))]
pub use fallback::{is_fullscreen_app_active, restore_previous_app, seconds_since_last_input};

/// SPEC 5: exposed to the frontend as Tauri commands.
pub mod commands {
    #[tauri::command]
    pub fn is_fullscreen_app_active() -> bool {
        super::is_fullscreen_app_active()
    }

    #[tauri::command]
    pub fn seconds_since_last_input() -> f64 {
        super::seconds_since_last_input()
    }
}
