//! macOS: Accessibility permission and a synthetic ⌘C for "add word".

use std::{thread, time::Duration};

use core_foundation::{
    base::TCFType,
    boolean::CFBoolean,
    dictionary::CFDictionary,
    string::{CFString, CFStringRef},
};
use core_graphics::{
    event::{CGEvent, CGEventFlags, CGEventTapLocation},
    event_source::{CGEventSource, CGEventSourceStateID},
};

#[link(name = "ApplicationServices", kind = "framework")]
unsafe extern "C" {
    fn AXIsProcessTrusted() -> bool;
    fn AXIsProcessTrustedWithOptions(options: core_foundation::dictionary::CFDictionaryRef)
    -> bool;
    static kAXTrustedCheckOptionPrompt: CFStringRef;
}

#[link(name = "CoreGraphics", kind = "framework")]
unsafe extern "C" {
    fn CGEventSourceFlagsState(state_id: i32) -> u64;
}

const COMBINED_SESSION_STATE: i32 = 0;
const KEY_C: u16 = 8;
const MODIFIER_MASK: u64 = 0x0010_0000 | 0x0002_0000 | 0x0008_0000 | 0x0004_0000; // cmd, shift, alt, ctrl

/// Whether this app may post keyboard events. With `prompt`, macOS shows its
/// permission dialog the first time.
pub fn accessibility_trusted(prompt: bool) -> bool {
    if !prompt {
        return unsafe { AXIsProcessTrusted() };
    }
    let key = unsafe { CFString::wrap_under_get_rule(kAXTrustedCheckOptionPrompt) };
    let options = CFDictionary::from_CFType_pairs(&[(key, CFBoolean::true_value())]);
    unsafe { AXIsProcessTrustedWithOptions(options.as_concrete_TypeRef()) }
}

/// Wait (up to `max`) until the user lets go of ⌘ ⇧ ⌥ ⌃ from the hotkey.
pub fn wait_modifiers_released(max: Duration) {
    let step = Duration::from_millis(20);
    let mut waited = Duration::ZERO;
    while waited < max {
        let flags = unsafe { CGEventSourceFlagsState(COMBINED_SESSION_STATE) };
        if flags & MODIFIER_MASK == 0 {
            return;
        }
        thread::sleep(step);
        waited += step;
    }
}

/// Post ⌘C to the frontmost app.
pub fn send_copy() -> Result<(), String> {
    let source = CGEventSource::new(CGEventSourceStateID::CombinedSessionState)
        .map_err(|_| "cannot create event source".to_string())?;
    for down in [true, false] {
        let event = CGEvent::new_keyboard_event(source.clone(), KEY_C, down)
            .map_err(|_| "cannot create key event".to_string())?;
        event.set_flags(CGEventFlags::CGEventFlagCommand);
        event.post(CGEventTapLocation::HID);
    }
    Ok(())
}

pub fn open_accessibility_settings() {
    let _ = std::process::Command::new("open")
        .arg("x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility")
        .spawn();
}
