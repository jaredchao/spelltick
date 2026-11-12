//! App settings (SPEC section 11), stored as one JSON value under key `app`
//! in the `settings` table. Missing fields fall back to defaults, so older
//! saved JSON keeps working when fields are added.

use std::sync::Mutex;

use rusqlite::{Connection, OptionalExtension, Result, params};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager, Runtime};

/// In-memory copy of the saved settings, shared by Rust-side consumers.
pub struct SettingsState(pub Mutex<Settings>);

/// "system" follows the OS: light -> native, dark -> terminal (SPEC 9).
pub fn resolve_skin(skin: &str, system_dark: bool) -> String {
    match skin {
        "system" if system_dark => "terminal".into(),
        "system" => "native".into(),
        other => other.into(),
    }
}

pub fn system_is_dark<R: Runtime>(app: &AppHandle<R>) -> bool {
    app.get_webview_window(crate::popup::LABEL)
        .and_then(|w| w.theme().ok())
        .is_some_and(|t| t == tauri::Theme::Dark)
}

pub const SETTINGS_KEY: &str = "app";

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum IntervalMode {
    Random,
    Fixed,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct ScheduleSettings {
    pub mode: IntervalMode,
    pub min_minutes: u32,
    pub max_minutes: u32,
    pub fixed_minutes: u32,
    pub work_hours_enabled: bool,
    /// "HH:MM", local time.
    pub work_start: String,
    pub work_end: String,
    pub skip_fullscreen: bool,
    pub defer_when_typing: bool,
}

impl Default for ScheduleSettings {
    fn default() -> Self {
        Self {
            mode: IntervalMode::Random,
            min_minutes: 15,
            max_minutes: 45,
            fixed_minutes: 30,
            work_hours_enabled: true,
            work_start: "09:00".into(),
            work_end: "18:00".into(),
            skip_fullscreen: true,
            defer_when_typing: true,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct QuizSettings {
    pub word_ratio: u32,
    pub sentence_ratio: u32,
    pub enabled_types: Vec<String>,
    pub daily_new_limit: u32,
    pub show_first_letter: bool,
}

impl Default for QuizSettings {
    fn default() -> Self {
        Self {
            word_ratio: 7,
            sentence_ratio: 3,
            enabled_types: vec!["zh2en".into(), "dictation".into(), "cloze".into()],
            daily_new_limit: 20,
            show_first_letter: true,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct AiSettings {
    pub base_url: String,
    pub model: String,
    pub generate_examples: bool,
    pub explain_mistakes: bool,
    pub new_cloze_from_mistakes: bool,
}

impl Default for AiSettings {
    fn default() -> Self {
        Self {
            base_url: String::new(),
            model: String::new(),
            generate_examples: true,
            explain_mistakes: true,
            new_cloze_from_mistakes: false,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct Settings {
    /// "native" | "terminal" | "paper" | "system"
    pub skin: String,
    pub summon_shortcut: String,
    pub add_word_shortcut: String,
    pub autostart: bool,
    pub sound_enabled: bool,
    pub schedule: ScheduleSettings,
    pub quiz: QuizSettings,
    pub ai: AiSettings,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            skin: "native".into(),
            summon_shortcut: "CommandOrControl+Shift+E".into(),
            add_word_shortcut: "CommandOrControl+Shift+A".into(),
            autostart: true,
            sound_enabled: true,
            schedule: ScheduleSettings::default(),
            quiz: QuizSettings::default(),
            ai: AiSettings::default(),
        }
    }
}

pub fn load(conn: &Connection) -> Result<Settings> {
    let raw: Option<String> = conn
        .query_row(
            "SELECT value FROM settings WHERE key = ?1",
            [SETTINGS_KEY],
            |r| r.get(0),
        )
        .optional()?;
    Ok(raw
        .and_then(|json| serde_json::from_str(&json).ok())
        .unwrap_or_default())
}

pub fn save(conn: &Connection, settings: &Settings) -> Result<()> {
    let json = serde_json::to_string(settings)
        .map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;
    conn.execute(
        "INSERT INTO settings (key, value) VALUES (?1, ?2)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        params![SETTINGS_KEY, json],
    )?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::migrations::migrate;

    fn conn() -> Connection {
        let mut c = Connection::open_in_memory().unwrap();
        migrate(&mut c).unwrap();
        c
    }

    #[test]
    fn system_skin_follows_dark_mode() {
        assert_eq!(resolve_skin("system", false), "native");
        assert_eq!(resolve_skin("system", true), "terminal");
        assert_eq!(resolve_skin("paper", true), "paper");
    }

    #[test]
    fn defaults_when_nothing_saved() {
        assert_eq!(load(&conn()).unwrap(), Settings::default());
    }

    #[test]
    fn round_trips() {
        let c = conn();
        let s = Settings {
            skin: "paper".into(),
            schedule: ScheduleSettings {
                mode: IntervalMode::Fixed,
                ..Default::default()
            },
            ..Default::default()
        };
        save(&c, &s).unwrap();
        assert_eq!(load(&c).unwrap(), s);
    }

    #[test]
    fn partial_json_fills_defaults() {
        let c = conn();
        c.execute(
            "INSERT INTO settings (key, value) VALUES ('app', '{\"skin\":\"terminal\",\"schedule\":{\"fixedMinutes\":10}}')",
            [],
        )
        .unwrap();
        let s = load(&c).unwrap();
        assert_eq!(s.skin, "terminal");
        assert_eq!(s.schedule.fixed_minutes, 10);
        assert_eq!(s.schedule.min_minutes, 15);
        assert_eq!(s.quiz.daily_new_limit, 20);
    }

    #[test]
    fn corrupt_json_falls_back_to_defaults() {
        let c = conn();
        c.execute(
            "INSERT INTO settings (key, value) VALUES ('app', 'not json')",
            [],
        )
        .unwrap();
        assert_eq!(load(&c).unwrap(), Settings::default());
    }
}
