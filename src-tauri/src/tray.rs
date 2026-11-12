//! System tray icon and native menu (SPEC section 10).

use tauri::{
    AppHandle, Manager, Runtime,
    menu::{Menu, MenuEvent, MenuItem, PredefinedMenuItem},
    tray::{TrayIcon, TrayIconBuilder},
};

const TRAY_ID: &str = "main";
const MENU_NEXT_LINE: &str = "status-next";
const MENU_TODAY_LINE: &str = "status-today";
const MENU_NEXT: &str = "next";
const MENU_PAUSE: &str = "pause";
const MENU_MUTE: &str = "mute";
const MENU_ADD_WORD: &str = "add-word";
const MENU_HISTORY: &str = "history";
const MENU_SETTINGS: &str = "settings";
const MENU_QUIT: &str = "quit";
#[cfg(debug_assertions)]
const MENU_DEBUG_PEEK: &str = "debug-peek";

/// Actions that can be triggered from the tray menu.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum MenuAction {
    Next,
    TogglePause,
    ToggleMute,
    AddWord,
    OpenHistory,
    OpenSettings,
    Quit,
    #[cfg(debug_assertions)]
    DebugPeek,
}

impl MenuAction {
    pub fn from_id(id: &str) -> Option<Self> {
        match id {
            MENU_NEXT => Some(Self::Next),
            MENU_PAUSE => Some(Self::TogglePause),
            MENU_MUTE => Some(Self::ToggleMute),
            MENU_ADD_WORD => Some(Self::AddWord),
            MENU_HISTORY => Some(Self::OpenHistory),
            MENU_SETTINGS => Some(Self::OpenSettings),
            MENU_QUIT => Some(Self::Quit),
            #[cfg(debug_assertions)]
            MENU_DEBUG_PEEK => Some(Self::DebugPeek),
            _ => None,
        }
    }
}

/// Text of the menu items that change at runtime.
#[derive(Debug, Clone, PartialEq, Eq, Default)]
pub struct TrayLabels {
    pub next_line: String,
    pub today_line: String,
    pub pause: String,
    pub mute: String,
}

/// Handles to the dynamic menu items, kept in Tauri state.
pub struct TrayMenu<R: Runtime> {
    next_line: MenuItem<R>,
    today_line: MenuItem<R>,
    pause: MenuItem<R>,
    mute: MenuItem<R>,
}

impl<R: Runtime> TrayMenu<R> {
    pub fn apply(&self, labels: &TrayLabels) {
        let pairs = [
            (&self.next_line, &labels.next_line),
            (&self.today_line, &labels.today_line),
            (&self.pause, &labels.pause),
            (&self.mute, &labels.mute),
        ];
        for (item, text) in pairs {
            if let Err(e) = item.set_text(text) {
                eprintln!("[tray] failed to update menu text: {e}");
            }
        }
    }
}

pub fn create<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<TrayIcon<R>> {
    let item = |id: &str, text: &str, enabled: bool, accel: Option<&str>| {
        MenuItem::with_id(app, id, text, enabled, accel)
    };
    let next_line = item(MENU_NEXT_LINE, "下一题计算中…", false, None)?;
    let today_line = item(MENU_TODAY_LINE, "今日 0 题", false, None)?;
    let next = item(MENU_NEXT, "立即来一题", true, Some(crate::shortcut::SUMMON))?;
    let pause = item(MENU_PAUSE, "暂停 1 小时", true, None)?;
    let mute = item(MENU_MUTE, "今天不再弹", true, None)?;
    let add_word = item(
        MENU_ADD_WORD,
        "加入生词…",
        true,
        Some("CommandOrControl+Shift+A"),
    )?;
    let history = item(MENU_HISTORY, "学习记录…", true, None)?;
    let settings = item(MENU_SETTINGS, "设置…", true, Some("CommandOrControl+,"))?;
    let quit = item(MENU_QUIT, "退出", true, None)?;

    let menu = Menu::with_items(
        app,
        &[
            &next_line,
            &today_line,
            &PredefinedMenuItem::separator(app)?,
            &next,
            &pause,
            &mute,
            &PredefinedMenuItem::separator(app)?,
            &add_word,
            &history,
            &settings,
            &PredefinedMenuItem::separator(app)?,
            &quit,
        ],
    )?;

    #[cfg(debug_assertions)]
    {
        let debug_peek = item(MENU_DEBUG_PEEK, "调试：5 秒后弹出", true, None)?;
        menu.insert(&debug_peek, 6)?;
    }

    app.manage(TrayMenu {
        next_line,
        today_line,
        pause,
        mute,
    });

    let builder = TrayIconBuilder::with_id(TRAY_ID)
        .tooltip("英语拼写")
        .menu(&menu)
        .on_menu_event(handle_menu_event);

    with_platform_icon(app, builder)?.build(app)
}

fn handle_menu_event<R: Runtime>(app: &AppHandle<R>, event: MenuEvent) {
    match MenuAction::from_id(event.id().as_ref()) {
        Some(MenuAction::Next) => crate::popup::summon(app),
        Some(MenuAction::TogglePause) => crate::scheduler::runtime::toggle_pause(app),
        Some(MenuAction::ToggleMute) => crate::scheduler::runtime::toggle_mute(app),
        Some(MenuAction::AddWord) => crate::add_word::trigger(app),
        Some(MenuAction::OpenHistory) => crate::settings_window::open(app, Some("history")),
        Some(MenuAction::OpenSettings) => crate::settings_window::open(app, None),
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
        assert_eq!(MenuAction::from_id("pause"), Some(MenuAction::TogglePause));
        assert_eq!(MenuAction::from_id("mute"), Some(MenuAction::ToggleMute));
        assert_eq!(
            MenuAction::from_id("settings"),
            Some(MenuAction::OpenSettings)
        );
    }

    #[test]
    fn status_lines_are_not_actions() {
        assert_eq!(MenuAction::from_id("status-next"), None);
        assert_eq!(MenuAction::from_id("unknown"), None);
    }
}
