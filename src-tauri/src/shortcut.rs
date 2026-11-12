//! Global shortcuts. The accelerators come from settings and are re-registered
//! when they change; failures are kept so the settings page can show them.

use std::sync::Mutex;

use serde::Serialize;
use tauri::{AppHandle, Manager, Runtime};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};

use crate::settings::Settings;

/// Default summon accelerator; also shown next to the tray item.
pub const SUMMON: &str = "CommandOrControl+Shift+E";

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Action {
    Summon,
    AddWord,
}

#[derive(Debug, Clone, Default, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ShortcutStatus {
    pub summon_error: Option<String>,
    pub add_word_error: Option<String>,
}

#[derive(Default)]
struct Registered {
    summon: Option<Shortcut>,
    add_word: Option<Shortcut>,
    status: ShortcutStatus,
}

#[derive(Default)]
pub struct ShortcutRegistry(Mutex<Registered>);

fn lock(registry: &ShortcutRegistry) -> std::sync::MutexGuard<'_, Registered> {
    registry.0.lock().unwrap_or_else(|p| p.into_inner())
}

pub fn plugin<R: Runtime>() -> tauri::plugin::TauriPlugin<R> {
    tauri_plugin_global_shortcut::Builder::new()
        .with_handler(|app, shortcut, event| {
            if event.state() != ShortcutState::Pressed {
                return;
            }
            match action_for(app, shortcut) {
                Some(Action::Summon) => crate::popup::summon(app),
                Some(Action::AddWord) => crate::add_word::trigger(app),
                None => {}
            }
        })
        .build()
}

fn action_for<R: Runtime>(app: &AppHandle<R>, shortcut: &Shortcut) -> Option<Action> {
    let registry = app.try_state::<ShortcutRegistry>()?;
    let reg = lock(&registry);
    if reg.summon.as_ref().is_some_and(|s| s.id() == shortcut.id()) {
        Some(Action::Summon)
    } else if reg
        .add_word
        .as_ref()
        .is_some_and(|s| s.id() == shortcut.id())
    {
        Some(Action::AddWord)
    } else {
        None
    }
}

fn register_one<R: Runtime>(
    app: &AppHandle<R>,
    accelerator: &str,
) -> (Option<Shortcut>, Option<String>) {
    let shortcut = match accelerator.parse::<Shortcut>() {
        Ok(s) => s,
        Err(e) => return (None, Some(format!("快捷键格式不对：{e}"))),
    };
    match app.global_shortcut().register(shortcut) {
        Ok(()) => (Some(shortcut), None),
        Err(e) => {
            eprintln!("[shortcut] failed to register {accelerator}: {e}");
            (None, Some("注册失败，可能已被其他应用占用".into()))
        }
    }
}

/// Unregister the current shortcuts and register the ones from `settings`.
pub fn apply<R: Runtime>(app: &AppHandle<R>, settings: &Settings) -> ShortcutStatus {
    let registry = app.state::<ShortcutRegistry>();
    let mut reg = lock(&registry);
    for s in [reg.summon.take(), reg.add_word.take()]
        .into_iter()
        .flatten()
    {
        let _ = app.global_shortcut().unregister(s);
    }
    let (summon, summon_error) = register_one(app, &settings.summon_shortcut);
    let (add_word, add_word_error) = if settings.add_word_shortcut == settings.summon_shortcut {
        (None, Some("和唤出答题的快捷键重复".into()))
    } else {
        register_one(app, &settings.add_word_shortcut)
    };
    reg.summon = summon;
    reg.add_word = add_word;
    reg.status = ShortcutStatus {
        summon_error,
        add_word_error,
    };
    reg.status.clone()
}

#[tauri::command]
pub fn shortcut_status<R: Runtime>(app: AppHandle<R>) -> ShortcutStatus {
    lock(&app.state::<ShortcutRegistry>()).status.clone()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn default_accelerators_parse() {
        let s = Settings::default();
        assert!(s.summon_shortcut.parse::<Shortcut>().is_ok());
        assert!(s.add_word_shortcut.parse::<Shortcut>().is_ok());
        assert_eq!(s.summon_shortcut, SUMMON);
    }

    #[test]
    fn different_accelerators_have_different_ids() {
        let a: Shortcut = "CommandOrControl+Shift+E".parse().unwrap();
        let b: Shortcut = "CommandOrControl+Shift+A".parse().unwrap();
        assert_ne!(a.id(), b.id());
    }
}
