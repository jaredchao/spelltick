//! "Add word" (SPEC 10): grab the selected text, open a small window with the
//! English filled in, and save it to「我的生词本」.

use std::sync::Mutex;

use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager, Runtime, WebviewUrl, WebviewWindowBuilder};

use crate::{
    db::{
        self, Db,
        decks::{self, NewItem},
    },
    platform, selection,
};

pub const LABEL: &str = "addword";
pub const EVENT_OPEN: &str = "addword://open";

/// Longer selections are almost certainly not a word or a sentence to learn.
const MAX_TERM_CHARS: usize = 200;

#[derive(Debug, Clone, Default, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Pending {
    pub term: String,
    /// macOS Accessibility permission is missing, so the copy could not run.
    pub needs_permission: bool,
}

#[derive(Default)]
pub struct AddWordState(Mutex<Pending>);

fn lock(state: &AddWordState) -> std::sync::MutexGuard<'_, Pending> {
    state.0.lock().unwrap_or_else(|p| p.into_inner())
}

/// Pure: keep one line of reasonable length.
pub fn clean_selection(text: &str) -> String {
    let first_line = text
        .lines()
        .map(str::trim)
        .find(|l| !l.is_empty())
        .unwrap_or("");
    first_line.chars().take(MAX_TERM_CHARS).collect()
}

/// Hotkey or tray item. Runs off the main thread: the copy waits for keys.
pub fn trigger<R: Runtime>(app: &AppHandle<R>) {
    let app = app.clone();
    std::thread::spawn(move || {
        platform::remember_frontmost_app();
        // Ask only when the feature is used (SPEC 15), never at startup.
        let trusted = platform::accessibility_trusted(true);
        let term = if trusted {
            selection::capture()
                .map(|t| clean_selection(&t))
                .unwrap_or_default()
        } else {
            String::new()
        };
        let pending = Pending {
            term,
            needs_permission: !trusted,
        };
        *lock(&app.state::<AddWordState>()) = pending.clone();
        show_window(&app);
        let _ = app.emit_to(LABEL, EVENT_OPEN, pending);
    });
}

fn show_window<R: Runtime>(app: &AppHandle<R>) {
    if let Some(win) = app.get_webview_window(LABEL) {
        let _ = win.show();
        let _ = win.set_focus();
        return;
    }
    let built = WebviewWindowBuilder::new(app, LABEL, WebviewUrl::App("index.html".into()))
        .title("加入生词")
        .inner_size(400.0, 360.0)
        .resizable(false)
        .always_on_top(true)
        .center()
        .focused(true)
        .build();
    match built {
        Ok(win) => {
            let _ = win.set_focus();
        }
        Err(e) => eprintln!("[addword] failed to open window: {e}"),
    }
}

pub mod commands {
    use super::*;

    #[tauri::command]
    pub fn addword_pending<R: Runtime>(app: AppHandle<R>) -> Pending {
        lock(&app.state::<AddWordState>()).clone()
    }

    /// Returns false when the word was already in the deck.
    #[tauri::command]
    pub fn addword_save<R: Runtime>(
        app: AppHandle<R>,
        term: String,
        meaning: String,
        example: Option<String>,
    ) -> Result<bool, String> {
        if term.trim().is_empty() || meaning.trim().is_empty() {
            return Err("英文和中文释义都要填".into());
        }
        let item = NewItem {
            term,
            meaning,
            example,
            phonetic: None,
            pos: None,
        };
        let added = {
            let db = app.state::<Db>();
            let mut conn = db.0.lock().unwrap_or_else(|p| p.into_inner());
            decks::add_to_user_deck(&mut conn, &item, db::now_ms()).map_err(|e| e.to_string())?
        };
        let _ = app.emit(crate::settings_cmd::EVENT_DECKS_CHANGED, ());
        Ok(added)
    }

    /// Hide the window and give focus back to the app the user came from.
    #[tauri::command]
    pub fn addword_close<R: Runtime>(app: AppHandle<R>) {
        if let Some(win) = app.get_webview_window(LABEL) {
            let _ = win.hide();
        }
        platform::restore_previous_app(&app);
    }

    #[tauri::command]
    pub fn accessibility_open_settings() {
        platform::open_accessibility_settings();
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn keeps_first_non_empty_line() {
        assert_eq!(clean_selection("\n  deploy  \nsecond"), "deploy");
    }

    #[test]
    fn caps_length() {
        assert_eq!(clean_selection(&"a".repeat(500)).len(), MAX_TERM_CHARS);
    }
}
