//! Settings and data commands used by the settings window.

use tauri::{AppHandle, Emitter, Manager, Runtime, State};

use crate::{
    db::{
        self, Db,
        decks::{self, DeckSummary, NewItem},
        progress,
    },
    settings::{self, Settings, SettingsState},
    shortcut::{self, ShortcutStatus},
};

pub const EVENT_SETTINGS_CHANGED: &str = "settings://changed";
pub const EVENT_DECKS_CHANGED: &str = "decks://changed";

fn lock<T>(m: &std::sync::Mutex<T>) -> std::sync::MutexGuard<'_, T> {
    m.lock().unwrap_or_else(|p| p.into_inner())
}

fn err(e: impl std::fmt::Display) -> String {
    e.to_string()
}

/// Turn the autostart login item on or off. Skipped in debug builds so
/// development binaries never register themselves.
pub fn apply_autostart<R: Runtime>(app: &AppHandle<R>, enabled: bool) {
    if cfg!(debug_assertions) {
        return;
    }
    use tauri_plugin_autostart::ManagerExt;
    let launcher = app.autolaunch();
    let current = launcher.is_enabled().unwrap_or(false);
    let result = match (enabled, current) {
        (true, false) => launcher.enable(),
        (false, true) => launcher.disable(),
        _ => Ok(()),
    };
    if let Err(e) = result {
        eprintln!("[autostart] failed to update: {e}");
    }
}

/// Apply everything that depends on settings, then tell all windows.
fn apply_and_broadcast<R: Runtime>(app: &AppHandle<R>, old: &Settings, new: &Settings) {
    if old.schedule != new.schedule {
        crate::scheduler::runtime::reschedule(app);
    }
    if old.summon_shortcut != new.summon_shortcut || old.add_word_shortcut != new.add_word_shortcut
    {
        shortcut::apply(app, new);
    }
    if old.autostart != new.autostart {
        apply_autostart(app, new.autostart);
    }
    if let Err(e) = app.emit(EVENT_SETTINGS_CHANGED, new) {
        eprintln!("[settings] failed to broadcast: {e}");
    }
}

#[tauri::command]
pub fn settings_get(state: State<'_, SettingsState>) -> Settings {
    lock(&state.0).clone()
}

#[tauri::command]
pub fn settings_set<R: Runtime>(
    app: AppHandle<R>,
    settings: Settings,
) -> Result<ShortcutStatus, String> {
    {
        let db = app.state::<Db>();
        let conn = lock(&db.0);
        settings::save(&conn, &settings).map_err(err)?;
    }
    let old = {
        let state = app.state::<SettingsState>();
        let mut current = lock(&state.0);
        std::mem::replace(&mut *current, settings.clone())
    };
    apply_and_broadcast(&app, &old, &settings);
    Ok(shortcut::shortcut_status(app))
}

#[tauri::command]
pub fn decks_list(db: State<'_, Db>) -> Result<Vec<DeckSummary>, String> {
    decks::list(&lock(&db.0)).map_err(err)
}

#[tauri::command]
pub fn decks_set_enabled<R: Runtime>(
    app: AppHandle<R>,
    id: i64,
    enabled: bool,
) -> Result<(), String> {
    decks::set_enabled(&lock(&app.state::<Db>().0), id, enabled).map_err(err)?;
    let _ = app.emit(EVENT_DECKS_CHANGED, ());
    Ok(())
}

#[tauri::command]
pub fn decks_delete<R: Runtime>(app: AppHandle<R>, id: i64) -> Result<bool, String> {
    let deleted = decks::delete(&lock(&app.state::<Db>().0), id).map_err(err)?;
    let _ = app.emit(EVENT_DECKS_CHANGED, ());
    Ok(deleted)
}

#[tauri::command]
pub fn decks_import<R: Runtime>(
    app: AppHandle<R>,
    name: String,
    items: Vec<NewItem>,
) -> Result<usize, String> {
    if name.trim().is_empty() {
        return Err("词库名不能为空".into());
    }
    let (_, inserted) = {
        let db = app.state::<Db>();
        let mut conn = lock(&db.0);
        decks::create_with_items(&mut conn, &name, "imported", &items, db::now_ms()).map_err(err)?
    };
    let _ = app.emit(EVENT_DECKS_CHANGED, ());
    Ok(inserted)
}

#[tauri::command]
pub fn read_text_file(path: String) -> Result<String, String> {
    let bytes = std::fs::read(&path).map_err(err)?;
    String::from_utf8(bytes).map_err(|_| "文件不是 UTF-8 编码".to_string())
}

#[tauri::command]
pub fn progress_export(db: State<'_, Db>, path: String) -> Result<(), String> {
    let file = progress::export(&lock(&db.0), db::now_ms()).map_err(err)?;
    let json = serde_json::to_string_pretty(&file).map_err(err)?;
    std::fs::write(&path, json).map_err(err)
}

#[tauri::command]
pub fn progress_import<R: Runtime>(app: AppHandle<R>, path: String) -> Result<(), String> {
    let json = read_text_file(path)?;
    let file = progress::parse(&json).map_err(err)?;
    {
        let db = app.state::<Db>();
        let mut conn = lock(&db.0);
        progress::import(&mut conn, &file).map_err(err)?;
    }
    let old = {
        let state = app.state::<SettingsState>();
        let mut current = lock(&state.0);
        std::mem::replace(&mut *current, file.settings.clone())
    };
    apply_and_broadcast(&app, &old, &file.settings);
    let _ = app.emit(EVENT_DECKS_CHANGED, ());
    Ok(())
}
