//! Global shortcuts.

use tauri::{AppHandle, Runtime};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};

pub const SUMMON: &str = "CommandOrControl+Shift+E";

pub fn plugin<R: Runtime>() -> tauri::plugin::TauriPlugin<R> {
    tauri_plugin_global_shortcut::Builder::new()
        .with_handler(|app, shortcut, event| {
            if event.state() == ShortcutState::Pressed && is_summon(shortcut) {
                crate::popup::summon(app);
            }
        })
        .build()
}

fn is_summon(shortcut: &Shortcut) -> bool {
    SUMMON
        .parse::<Shortcut>()
        .map(|s| s.id() == shortcut.id())
        .unwrap_or(false)
}

/// Register default shortcuts. Failure (e.g. taken by another app) is logged;
/// the settings page will surface it in M4.
pub fn register_defaults<R: Runtime>(app: &AppHandle<R>) {
    if let Err(e) = app.global_shortcut().register(SUMMON) {
        eprintln!("[shortcut] failed to register {SUMMON}: {e}");
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn summon_accelerator_parses() {
        assert!(SUMMON.parse::<Shortcut>().is_ok());
    }

    #[test]
    fn recognizes_summon_shortcut() {
        let shortcut: Shortcut = SUMMON.parse().unwrap();
        assert!(is_summon(&shortcut));
    }

    #[test]
    fn rejects_other_shortcut() {
        let other: Shortcut = "CommandOrControl+Shift+A".parse().unwrap();
        assert!(!is_summon(&other));
    }
}
