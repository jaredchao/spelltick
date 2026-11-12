//! Platform-specific integrations (fullscreen detection, idle time,
//! keychain, selected text). macOS and Windows live in separate modules.

#[cfg(target_os = "macos")]
mod macos;

#[cfg(target_os = "windows")]
mod windows;
