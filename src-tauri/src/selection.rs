//! Read the user's selected text (SPEC 10): simulate a copy, read the
//! clipboard, then put the previous clipboard text back.

use std::{thread, time::Duration};

use arboard::Clipboard;

use crate::platform;

const SENTINEL_PREFIX: &str = "\u{2063}english-spell-selection-probe-";
const WAIT_STEP: Duration = Duration::from_millis(25);
const WAIT_MAX: Duration = Duration::from_millis(500);

/// Pure: the selected text from what the clipboard held after the copy.
pub fn picked_text(after: Option<&str>, sentinel: &str) -> Option<String> {
    let text = after?.trim();
    if text.is_empty() || text == sentinel {
        None
    } else {
        Some(text.to_string())
    }
}

/// Returns the trimmed selection, or None when nothing was selected.
/// Only plain text on the clipboard is restored afterwards.
pub fn capture() -> Option<String> {
    let mut clipboard = Clipboard::new().ok()?;
    let previous = clipboard.get_text().ok();
    let sentinel = format!("{SENTINEL_PREFIX}{}", crate::db::now_ms());
    clipboard.set_text(sentinel.clone()).ok()?;

    platform::wait_modifiers_released(Duration::from_millis(800));
    if let Err(e) = platform::send_copy() {
        eprintln!("[selection] copy failed: {e}");
    }

    let mut waited = Duration::ZERO;
    let mut after = None;
    while waited < WAIT_MAX {
        thread::sleep(WAIT_STEP);
        waited += WAIT_STEP;
        let current = clipboard.get_text().ok();
        if current.as_deref() != Some(sentinel.as_str()) {
            after = current;
            break;
        }
    }

    let picked = picked_text(after.as_deref(), &sentinel);
    let _ = match previous {
        Some(text) => clipboard.set_text(text),
        None => clipboard.clear(),
    };
    picked
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn unchanged_clipboard_means_no_selection() {
        assert_eq!(picked_text(Some("probe"), "probe"), None);
        assert_eq!(picked_text(None, "probe"), None);
        assert_eq!(picked_text(Some("   "), "probe"), None);
    }

    #[test]
    fn trims_selected_text() {
        assert_eq!(
            picked_text(Some("  deploy \n"), "probe"),
            Some("deploy".into())
        );
    }
}
