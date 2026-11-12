mod add_word;
mod applog;
mod db;
mod geometry;
mod keychain;
mod platform;
mod popup;
mod scheduler;
mod selection;
mod settings;
mod settings_cmd;
mod settings_window;
mod shortcut;
mod skin_copy;
mod tray;

use std::sync::Mutex;

use tauri::{Manager, RunEvent};

fn open_database(
    app: &tauri::App,
) -> Result<(db::Db, settings::SettingsState), Box<dyn std::error::Error>> {
    let dir = app.path().app_data_dir()?;
    std::fs::create_dir_all(&dir)?;
    let conn = db::open(&dir.join(db::FILE_NAME), db::now_ms())?;
    let loaded = settings::load(&conn)?;
    Ok((
        db::Db(Mutex::new(conn)),
        settings::SettingsState(Mutex::new(loaded)),
    ))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // Must be registered first so a second launch exits before doing anything else.
        .plugin(tauri_plugin_single_instance::init(|_app, _args, _cwd| {}))
        .plugin(shortcut::plugin())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ))
        .invoke_handler(tauri::generate_handler![
            popup::popup_place,
            popup::popup_show_peek,
            popup::popup_focus,
            popup::popup_hide,
            db::commands::quiz_candidates,
            db::commands::quiz_record_attempt,
            db::commands::quiz_today_stats,
            db::commands::quiz_item,
            platform::commands::is_fullscreen_app_active,
            platform::commands::seconds_since_last_input,
            scheduler::runtime::commands::scheduler_popup_closed,
            settings_cmd::settings_get,
            settings_cmd::settings_set,
            settings_cmd::decks_list,
            settings_cmd::decks_set_enabled,
            settings_cmd::decks_delete,
            settings_cmd::decks_import,
            settings_cmd::read_text_file,
            settings_cmd::progress_export,
            settings_cmd::progress_import,
            settings_window::settings_window_open,
            shortcut::shortcut_status,
            db::commands::quiz_set_example,
            keychain::commands::ai_key_get,
            keychain::commands::ai_key_has,
            keychain::commands::ai_key_set,
            applog::log_write,
            add_word::commands::addword_pending,
            add_word::commands::addword_save,
            add_word::commands::addword_close,
            add_word::commands::accessibility_open_settings,
        ])
        .setup(|app| {
            // Tray-only app: no Dock icon on macOS.
            #[cfg(target_os = "macos")]
            app.set_activation_policy(tauri::ActivationPolicy::Accessory);

            let (database, settings_state) = open_database(app)?;
            let initial = settings_state
                .0
                .lock()
                .map(|s| s.clone())
                .unwrap_or_default();
            app.manage(database);
            app.manage(settings_state);
            app.manage(shortcut::ShortcutRegistry::default());
            app.manage(add_word::AddWordState::default());
            app.manage(scheduler::runtime::SchedulerHandle::default());
            popup::create(app.handle())?;
            tray::create(app.handle())?;
            shortcut::apply(app.handle(), &initial);
            settings_cmd::apply_autostart(app.handle(), initial.autostart);
            scheduler::runtime::start(app.handle().clone());

            // Dev-only: `SPELL_DEBUG_PEEK=<seconds>` shows the peek once after startup.
            #[cfg(debug_assertions)]
            if let Some(secs) = std::env::var("SPELL_DEBUG_PEEK")
                .ok()
                .and_then(|v| v.parse::<u64>().ok())
            {
                popup::peek_after(app.handle(), std::time::Duration::from_secs(secs));
            }
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|_app, event| {
            // Keep running in the tray when the last window closes.
            // An explicit `app.exit(code)` carries a code and is allowed through.
            if let RunEvent::ExitRequested {
                code: None, api, ..
            } = event
            {
                api.prevent_exit();
            }
        });
}
