//! macOS implementations.

use core_foundation::{
    array::CFArray,
    base::{CFType, TCFType},
    dictionary::CFDictionary,
    number::CFNumber,
    string::CFString,
};
use core_graphics::{
    display::CGDisplay,
    window::{
        copy_window_info, kCGNullWindowID, kCGWindowBounds, kCGWindowLayer,
        kCGWindowListExcludeDesktopElements, kCGWindowListOptionOnScreenOnly, kCGWindowOwnerPID,
    },
};
use tauri::{AppHandle, Runtime};

/// Deactivate this app so macOS re-activates the app the user was in before.
/// `NSApp.hide` hides every window of this app; the popup is already hidden.
// TODO(M4): once the settings window exists, avoid hiding it here.
pub fn restore_previous_app<R: Runtime>(app: &AppHandle<R>) {
    if let Err(e) = app.hide() {
        eprintln!("[platform] failed to hide app: {e}");
    }
}

#[link(name = "CoreGraphics", kind = "framework")]
unsafe extern "C" {
    fn CGEventSourceSecondsSinceLastEventType(state_id: i32, event_type: u32) -> f64;
}

const COMBINED_SESSION_STATE: i32 = 0;
const ANY_INPUT_EVENT_TYPE: u32 = u32::MAX;

/// Seconds since the last keyboard or mouse input. Reads timing only,
/// never input content, and needs no extra permission.
pub fn seconds_since_last_input() -> f64 {
    unsafe { CGEventSourceSecondsSinceLastEventType(COMBINED_SESSION_STATE, ANY_INPUT_EVENT_TYPE) }
}

#[derive(Debug, Clone, Copy, PartialEq)]
struct Rect {
    x: f64,
    y: f64,
    w: f64,
    h: f64,
}

fn number(dict: &CFDictionary<CFString, CFType>, key: &str) -> Option<f64> {
    dict.find(CFString::new(key))
        .and_then(|v| v.downcast::<CFNumber>())
        .and_then(|n| n.to_f64())
}

fn window_rect(info: &CFDictionary<CFString, CFType>) -> Option<Rect> {
    let bounds_key = unsafe { CFString::wrap_under_get_rule(kCGWindowBounds) };
    let bounds = info.find(bounds_key)?.downcast::<CFDictionary>()?;
    let bounds: CFDictionary<CFString, CFType> =
        unsafe { CFDictionary::wrap_under_get_rule(bounds.as_concrete_TypeRef()) };
    Some(Rect {
        x: number(&bounds, "X")?,
        y: number(&bounds, "Y")?,
        w: number(&bounds, "Width")?,
        h: number(&bounds, "Height")?,
    })
}

fn int_value(
    info: &CFDictionary<CFString, CFType>,
    key: core_foundation::string::CFStringRef,
) -> Option<i64> {
    let key = unsafe { CFString::wrap_under_get_rule(key) };
    info.find(key)
        .and_then(|v| v.downcast::<CFNumber>())
        .and_then(|n| n.to_i64())
}

fn display_rects() -> Vec<Rect> {
    CGDisplay::active_displays()
        .unwrap_or_default()
        .into_iter()
        .map(|id| {
            let b = CGDisplay::new(id).bounds();
            Rect {
                x: b.origin.x,
                y: b.origin.y,
                w: b.size.width,
                h: b.size.height,
            }
        })
        .collect()
}

fn covers(window: &Rect, display: &Rect) -> bool {
    const EPS: f64 = 1.0;
    (window.x - display.x).abs() <= EPS
        && (window.y - display.y).abs() <= EPS
        && window.w + EPS >= display.w
        && window.h + EPS >= display.h
}

/// Whether the frontmost normal window covers a whole display (meetings,
/// presentations, fullscreen video). The window list is ordered front to
/// back; the first layer-0 window not owned by this app is the front one.
pub fn is_fullscreen_app_active() -> bool {
    let own_pid = i64::from(std::process::id());
    let Some(list) = copy_window_info(
        kCGWindowListOptionOnScreenOnly | kCGWindowListExcludeDesktopElements,
        kCGNullWindowID,
    ) else {
        return false;
    };
    let list: CFArray<CFDictionary<CFString, CFType>> =
        unsafe { CFArray::wrap_under_get_rule(list.as_concrete_TypeRef()) };
    let displays = display_rects();

    for info in list.iter() {
        if int_value(&info, unsafe { kCGWindowLayer }) != Some(0) {
            continue;
        }
        if int_value(&info, unsafe { kCGWindowOwnerPID }) == Some(own_pid) {
            continue;
        }
        return window_rect(&info).is_some_and(|w| displays.iter().any(|d| covers(&w, d)));
    }
    false
}

#[cfg(test)]
mod tests {
    use super::*;

    const DISPLAY: Rect = Rect {
        x: 0.0,
        y: 0.0,
        w: 1440.0,
        h: 900.0,
    };

    #[test]
    fn exact_match_covers() {
        assert!(covers(&DISPLAY, &DISPLAY));
    }

    #[test]
    fn maximized_window_below_menu_bar_does_not_cover() {
        let w = Rect {
            x: 0.0,
            y: 25.0,
            w: 1440.0,
            h: 875.0,
        };
        assert!(!covers(&w, &DISPLAY));
    }

    #[test]
    fn window_on_second_display_matches_that_display() {
        let second = Rect {
            x: 1440.0,
            y: 0.0,
            w: 1920.0,
            h: 1080.0,
        };
        assert!(covers(&second, &second));
        assert!(!covers(&second, &DISPLAY));
    }

    #[test]
    fn probes_do_not_panic() {
        let _ = is_fullscreen_app_active();
        assert!(seconds_since_last_input() >= 0.0);
    }
}
