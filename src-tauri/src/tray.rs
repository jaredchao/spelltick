//! System tray icon and native menu.

use tauri::{
    menu::{Menu, MenuEvent, MenuItem},
    tray::{TrayIcon, TrayIconBuilder},
    AppHandle, Runtime,
};

const TRAY_ID: &str = "main";
const MENU_QUIT: &str = "quit";

/// Actions that can be triggered from the tray menu.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum MenuAction {
    Quit,
}

impl MenuAction {
    pub fn from_id(id: &str) -> Option<Self> {
        match id {
            MENU_QUIT => Some(Self::Quit),
            _ => None,
        }
    }
}

pub fn create<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<TrayIcon<R>> {
    let quit = MenuItem::with_id(app, MENU_QUIT, "退出", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&quit])?;

    let builder = TrayIconBuilder::with_id(TRAY_ID)
        .tooltip("英语拼写")
        .menu(&menu)
        .on_menu_event(handle_menu_event);

    with_platform_icon(app, builder)?.build(app)
}

fn handle_menu_event<R: Runtime>(app: &AppHandle<R>, event: MenuEvent) {
    match MenuAction::from_id(event.id().as_ref()) {
        Some(MenuAction::Quit) => app.exit(0),
        None => {}
    }
}

/// macOS: monochrome template image that adapts to light/dark menu bar.
#[cfg(target_os = "macos")]
fn with_platform_icon<R: Runtime>(
    _app: &AppHandle<R>,
    builder: TrayIconBuilder<R>,
) -> tauri::Result<TrayIconBuilder<R>> {
    let icon = tauri::image::Image::from_bytes(include_bytes!("../icons/tray-template.png"))?;
    Ok(builder.icon(icon).icon_as_template(true))
}

/// Windows and others: reuse the colored app icon so it stays visible on dark taskbars.
#[cfg(not(target_os = "macos"))]
fn with_platform_icon<R: Runtime>(
    app: &AppHandle<R>,
    builder: TrayIconBuilder<R>,
) -> tauri::Result<TrayIconBuilder<R>> {
    match app.default_window_icon() {
        Some(icon) => Ok(builder.icon(icon.clone())),
        None => Ok(builder),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn maps_quit_id_to_quit_action() {
        assert_eq!(MenuAction::from_id("quit"), Some(MenuAction::Quit));
    }

    #[test]
    fn unknown_id_maps_to_none() {
        assert_eq!(MenuAction::from_id("unknown"), None);
    }
}
