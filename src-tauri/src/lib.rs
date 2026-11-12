mod geometry;
mod platform;
mod popup;
mod shortcut;
mod tray;

use tauri::RunEvent;

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
        ])
        .setup(|app| {
            // Tray-only app: no Dock icon on macOS.
            #[cfg(target_os = "macos")]
            app.set_activation_policy(tauri::ActivationPolicy::Accessory);

            popup::create(app.handle())?;
            tray::create(app.handle())?;
            shortcut::register_defaults(app.handle());

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
            if let RunEvent::ExitRequested { code: None, api, .. } = event {
                api.prevent_exit();
            }
        });
}
