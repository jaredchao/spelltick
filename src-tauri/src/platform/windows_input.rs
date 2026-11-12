//! Windows: a synthetic Ctrl+C for "add word". No extra permission needed.
// TODO(windows-test): verify copy works in common apps (browser, Word, VS Code).

use std::{thread, time::Duration};

use windows_sys::Win32::UI::Input::KeyboardAndMouse::{
    GetAsyncKeyState, INPUT, INPUT_0, INPUT_KEYBOARD, KEYBDINPUT, KEYEVENTF_KEYUP, SendInput,
    VK_CONTROL, VK_LWIN, VK_MENU, VK_RWIN, VK_SHIFT,
};

pub fn accessibility_trusted(_prompt: bool) -> bool {
    true
}

fn pressed(vk: u16) -> bool {
    (unsafe { GetAsyncKeyState(i32::from(vk)) } as u16 & 0x8000) != 0
}

pub fn wait_modifiers_released(max: Duration) {
    let step = Duration::from_millis(20);
    let mut waited = Duration::ZERO;
    while waited < max {
        if ![VK_CONTROL, VK_SHIFT, VK_MENU, VK_LWIN, VK_RWIN]
            .into_iter()
            .any(pressed)
        {
            return;
        }
        thread::sleep(step);
        waited += step;
    }
}

fn key(vk: u16, up: bool) -> INPUT {
    INPUT {
        r#type: INPUT_KEYBOARD,
        Anonymous: INPUT_0 {
            ki: KEYBDINPUT {
                wVk: vk,
                wScan: 0,
                dwFlags: if up { KEYEVENTF_KEYUP } else { 0 },
                time: 0,
                dwExtraInfo: 0,
            },
        },
    }
}

pub fn send_copy() -> Result<(), String> {
    const VK_C: u16 = 0x43;
    let inputs = [
        key(VK_CONTROL, false),
        key(VK_C, false),
        key(VK_C, true),
        key(VK_CONTROL, true),
    ];
    let sent = unsafe {
        SendInput(
            inputs.len() as u32,
            inputs.as_ptr(),
            std::mem::size_of::<INPUT>() as i32,
        )
    };
    if sent as usize == inputs.len() {
        Ok(())
    } else {
        Err("SendInput failed".into())
    }
}

pub fn open_accessibility_settings() {}
