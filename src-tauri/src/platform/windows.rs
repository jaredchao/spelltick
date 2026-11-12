//! Windows implementations.

use tauri::{AppHandle, Runtime};
use windows_sys::Win32::{
    System::SystemInformation::GetTickCount,
    UI::{
        Input::KeyboardAndMouse::{GetLastInputInfo, LASTINPUTINFO},
        Shell::{
            QUNS_BUSY, QUNS_PRESENTATION_MODE, QUNS_RUNNING_D3D_FULL_SCREEN,
            SHQueryUserNotificationState,
        },
    },
};

/// Hiding the focused popup lets Windows activate the next window in z-order,
/// which is normally the app the user came from. Nothing extra for now.
// TODO(windows-test): verify focus returns to the previous app.
pub fn restore_previous_app<R: Runtime>(_app: &AppHandle<R>) {}

/// SPEC 5: busy, D3D fullscreen and presentation mode count as fullscreen.
// TODO(windows-test): verify with a fullscreen video and a slideshow.
pub fn is_fullscreen_app_active() -> bool {
    let mut state = 0;
    let hr = unsafe { SHQueryUserNotificationState(&mut state) };
    hr == 0
        && (state == QUNS_BUSY
            || state == QUNS_RUNNING_D3D_FULL_SCREEN
            || state == QUNS_PRESENTATION_MODE)
}

/// Seconds since the last keyboard or mouse input (timing only, no content).
pub fn seconds_since_last_input() -> f64 {
    let mut info = LASTINPUTINFO {
        cbSize: std::mem::size_of::<LASTINPUTINFO>() as u32,
        dwTime: 0,
    };
    let ok = unsafe { GetLastInputInfo(&mut info) };
    if ok == 0 {
        return f64::MAX;
    }
    let now = unsafe { GetTickCount() };
    f64::from(now.wrapping_sub(info.dwTime)) / 1000.0
}
