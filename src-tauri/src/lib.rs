mod db;
mod geometry;
mod platform;
mod popup;
mod scheduler;
mod settings;
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
        ])
        .setup(|app| {
            // Tray-only app: no Dock icon on macOS.
            #[cfg(target_os = "macos")]
            app.set_activation_policy(tauri::ActivationPolicy::Accessory);

            let (database, settings_state) = open_database(app)?;
            app.manage(database);
            app.manage(settings_state);
            app.manage(scheduler::runtime::SchedulerHandle::default());
            popup::create(app.handle())?;
            tray::create(app.handle())?;
            shortcut::register_defaults(app.handle());
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
