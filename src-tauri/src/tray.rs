//! System tray icon and native menu.

use tauri::{
    AppHandle, Runtime,
    menu::{Menu, MenuEvent, MenuItem, PredefinedMenuItem},
    tray::{TrayIcon, TrayIconBuilder},
};

const TRAY_ID: &str = "main";
const MENU_NEXT: &str = "next";
const MENU_QUIT: &str = "quit";
#[cfg(debug_assertions)]
const MENU_DEBUG_PEEK: &str = "debug-peek";

/// Actions that can be triggered from the tray menu.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum MenuAction {
    Next,
    Quit,
    #[cfg(debug_assertions)]
    DebugPeek,
}

impl MenuAction {
    pub fn from_id(id: &str) -> Option<Self> {
        match id {
            MENU_NEXT => Some(Self::Next),
            MENU_QUIT => Some(Self::Quit),
            #[cfg(debug_assertions)]
            MENU_DEBUG_PEEK => Some(Self::DebugPeek),
            _ => None,
        }
    }
}

pub fn create<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<TrayIcon<R>> {
    let next = MenuItem::with_id(
        app,
        MENU_NEXT,
        "立即来一题",
        true,
        Some(crate::shortcut::SUMMON),
    )?;
    let separator = PredefinedMenuItem::separator(app)?;
    let quit = MenuItem::with_id(app, MENU_QUIT, "退出", true, None::<&str>)?;

    let menu = Menu::with_items(app, &[&next, &separator, &quit])?;

    #[cfg(debug_assertions)]
    {
        let debug_peek =
            MenuItem::with_id(app, MENU_DEBUG_PEEK, "调试：5 秒后弹出", true, None::<&str>)?;
        menu.insert(&debug_peek, 1)?;
    }

    let builder = TrayIconBuilder::with_id(TRAY_ID)
        .tooltip("英语拼写")
        .menu(&menu)
        .on_menu_event(handle_menu_event);

    with_platform_icon(app, builder)?.build(app)
}

fn handle_menu_event<R: Runtime>(app: &AppHandle<R>, event: MenuEvent) {
    match MenuAction::from_id(event.id().as_ref()) {
        Some(MenuAction::Next) => crate::popup::summon(app),
        Some(MenuAction::Quit) => app.exit(0),
        #[cfg(debug_assertions)]
        Some(MenuAction::DebugPeek) => {
            crate::popup::peek_after(app, std::time::Duration::from_secs(5))
        }
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
    fn maps_known_ids() {
        assert_eq!(MenuAction::from_id("quit"), Some(MenuAction::Quit));
        assert_eq!(MenuAction::from_id("next"), Some(MenuAction::Next));
    }

    #[test]
    fn unknown_id_maps_to_none() {
        assert_eq!(MenuAction::from_id("unknown"), None);
    }
}
