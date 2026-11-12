//! Platform-specific integrations. macOS and Windows live in separate modules
//! and expose the same functions.

#[cfg(target_os = "macos")]
mod macos;
#[cfg(target_os = "macos")]
mod macos_focus;
#[cfg(target_os = "macos")]
mod macos_input;
#[cfg(target_os = "macos")]
pub use macos::{
    is_fullscreen_app_active, remember_frontmost_app, restore_previous_app,
    seconds_since_last_input,
};
#[cfg(target_os = "macos")]
pub use macos_input::{
    accessibility_trusted, open_accessibility_settings, send_copy, wait_modifiers_released,
};

#[cfg(target_os = "windows")]
mod windows;
#[cfg(target_os = "windows")]
mod windows_input;
#[cfg(target_os = "windows")]
pub use windows::{
    is_fullscreen_app_active, remember_frontmost_app, restore_previous_app,
    seconds_since_last_input,
};
#[cfg(target_os = "windows")]
pub use windows_input::{
    accessibility_trusted, open_accessibility_settings, send_copy, wait_modifiers_released,
};

#[cfg(not(any(target_os = "macos", target_os = "windows")))]
mod fallback {
    pub fn restore_previous_app<R: tauri::Runtime>(_app: &tauri::AppHandle<R>) {}
    pub fn remember_frontmost_app() {}
    pub fn is_fullscreen_app_active() -> bool {
        false
    }
    pub fn seconds_since_last_input() -> f64 {
        f64::MAX
    }
    pub fn accessibility_trusted(_prompt: bool) -> bool {
        true
    }
    pub fn wait_modifiers_released(_max: std::time::Duration) {}
    pub fn send_copy() -> Result<(), String> {
        Err("unsupported platform".into())
    }
    pub fn open_accessibility_settings() {}
}
#[cfg(not(any(target_os = "macos", target_os = "windows")))]
pub use fallback::{
    accessibility_trusted, is_fullscreen_app_active, open_accessibility_settings,
    remember_frontmost_app, restore_previous_app, seconds_since_last_input, send_copy,
    wait_modifiers_released,
};

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
