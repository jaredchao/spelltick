//! Background loop: ticks the scheduler once a second, fires the popup and
//! keeps the tray status lines current.

use std::{
    sync::{Mutex, MutexGuard},
    thread,
    time::Duration,
};

use chrono::{DateTime, Local, TimeZone};
use tauri::{AppHandle, Manager, Runtime};

use super::core::{CloseReason, Probe, SchedulerState};
use crate::{
    db::{self, Db, quiz::TodayStats},
    popup,
    settings::{ScheduleSettings, SettingsState},
    skin_copy::{fill, format_duration, format_rate, tray_copy},
    tray::{TrayLabels, TrayMenu},
};

const TICK: Duration = Duration::from_secs(1);
/// Refresh today's stats every N ticks.
const STATS_EVERY_TICKS: u32 = 10;

#[derive(Default)]
pub struct SchedulerHandle(pub Mutex<SchedulerState>);

struct OsProbe;

impl Probe for OsProbe {
    fn fullscreen_app_active(&self) -> bool {
        crate::platform::is_fullscreen_app_active()
    }
    fn seconds_since_last_input(&self) -> f64 {
        crate::platform::seconds_since_last_input()
    }
}

fn lock<T>(m: &Mutex<T>) -> MutexGuard<'_, T> {
    m.lock().unwrap_or_else(|poisoned| poisoned.into_inner())
}

fn schedule_settings<R: Runtime>(app: &AppHandle<R>) -> ScheduleSettings {
    lock(&app.state::<SettingsState>().0).schedule.clone()
}

fn skin_id<R: Runtime>(app: &AppHandle<R>) -> String {
    let skin = lock(&app.state::<SettingsState>().0).skin.clone();
    crate::settings::resolve_skin(&skin, crate::settings::system_is_dark(app))
}

fn day_start<Tz: TimeZone>(now: &DateTime<Tz>) -> i64 {
    now.timezone()
        .from_local_datetime(&now.date_naive().and_hms_opt(0, 0, 0).unwrap_or_default())
        .earliest()
        .map(|t| t.timestamp_millis())
        .unwrap_or_else(|| now.timestamp_millis())
}

fn today_stats<R: Runtime>(app: &AppHandle<R>, now: &DateTime<Local>) -> TodayStats {
    let db = app.state::<Db>();
    let conn = lock(&db.0);
    db::quiz::today_stats(&conn, day_start(now)).unwrap_or(TodayStats {
        total: 0,
        correct: 0,
    })
}

/// Pure: tray text for the current scheduler state.
pub fn tray_labels<Tz: TimeZone>(
    state: &SchedulerState,
    now: &DateTime<Tz>,
    stats: &TodayStats,
    skin: &str,
) -> TrayLabels {
    let now_ms = now.timestamp_millis();
    let copy = tray_copy(skin);
    let next_in = state
        .due_at()
        .map(|due| format_duration((due - now_ms).max(0)))
        .unwrap_or_else(|| "—".into());
    let pause = match state.paused_until.filter(|&u| u > now_ms) {
        Some(until) => format!("恢复（还剩 {}）", format_duration(until - now_ms)),
        None => "暂停 1 小时".into(),
    };
    let mute = if state.is_muted(now) {
        "恢复弹出"
    } else {
        "今天不再弹"
    };
    TrayLabels {
        next_line: fill(&copy.tray_next, &[("time", &next_in)]),
        today_line: fill(
            &copy.tray_today,
            &[
                ("n", &stats.total.to_string()),
                ("rate", &format_rate(stats.correct, stats.total)),
            ],
        ),
        pause,
        mute: mute.into(),
    }
}

pub fn start<R: Runtime>(app: AppHandle<R>) {
    thread::spawn(move || {
        let mut last_labels = TrayLabels::default();
        let mut stats = TodayStats {
            total: 0,
            correct: 0,
        };
        let mut ticks: u32 = 0;
        loop {
            let now = Local::now();
            let settings = schedule_settings(&app);
            let fire = {
                let handle = app.state::<SchedulerHandle>();
                let mut state = lock(&handle.0);
                state.tick(
                    &settings,
                    &now,
                    popup::is_visible(),
                    &OsProbe,
                    fastrand::f64(),
                )
            };
            if let Some(fire) = fire {
                popup::peek(&app, fire.retry_item);
            }

            if ticks.is_multiple_of(STATS_EVERY_TICKS) {
                stats = today_stats(&app, &now);
            }
            ticks = ticks.wrapping_add(1);
            let labels = {
                let handle = app.state::<SchedulerHandle>();
                let state = lock(&handle.0);
                tray_labels(&state, &now, &stats, &skin_id(&app))
            };
            if labels != last_labels {
                if let Some(menu) = app.try_state::<TrayMenu<R>>() {
                    menu.apply(&labels);
                }
                last_labels = labels;
            }
            thread::sleep(TICK);
        }
    });
}

fn with_state<R: Runtime>(
    app: &AppHandle<R>,
    f: impl FnOnce(&mut SchedulerState, &ScheduleSettings, &DateTime<Local>),
) {
    let settings = schedule_settings(app);
    let now = Local::now();
    let handle = app.state::<SchedulerHandle>();
    let mut state = lock(&handle.0);
    f(&mut state, &settings, &now);
}

pub fn toggle_pause<R: Runtime>(app: &AppHandle<R>) {
    with_state(app, |st, s, now| {
        if st.is_paused(now.timestamp_millis()) {
            st.resume(s, now, fastrand::f64());
        } else {
            st.pause(s, now, fastrand::f64());
        }
    });
}

pub fn toggle_mute<R: Runtime>(app: &AppHandle<R>) {
    with_state(app, |st, s, now| {
        if st.is_muted(now) {
            st.resume(s, now, fastrand::f64());
        } else {
            st.mute_today(s, now, fastrand::f64());
        }
    });
}

/// Settings changed: restart the interval from now.
pub fn reschedule<R: Runtime>(app: &AppHandle<R>) {
    with_state(app, |st, s, now| st.reschedule(s, now, fastrand::f64()));
}

pub mod commands {
    use super::*;

    /// The frontend reports why the popup closed. `reason` is "timeout" or "done".
    #[tauri::command]
    pub fn scheduler_popup_closed<R: Runtime>(
        app: AppHandle<R>,
        reason: String,
        item_id: Option<i64>,
    ) {
        let reason = if reason == "timeout" {
            CloseReason::Timeout
        } else {
            CloseReason::Done
        };
        with_state(&app, |st, s, now| {
            st.on_closed(s, now, reason, item_id, fastrand::f64())
        });
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::Utc;

    fn at(h: u32, m: u32) -> DateTime<Utc> {
        Utc.with_ymd_and_hms(2026, 11, 12, h, m, 0).unwrap()
    }

    #[test]
    fn labels_show_countdown_and_stats() {
        let st = SchedulerState {
            next_at: Some(at(10, 12).timestamp_millis()),
            ..Default::default()
        };
        let labels = tray_labels(
            &st,
            &at(10, 0),
            &TodayStats {
                total: 18,
                correct: 15,
            },
            "native",
        );
        assert_eq!(labels.next_line, "下一题约 12 分钟后");
        assert_eq!(labels.today_line, "今日 18 题 · 正确率 83%");
        assert_eq!(labels.pause, "暂停 1 小时");
        assert_eq!(labels.mute, "今天不再弹");
    }

    #[test]
    fn labels_show_pause_remaining_and_mute() {
        let st = SchedulerState {
            next_at: Some(at(12, 0).timestamp_millis()),
            paused_until: Some(at(10, 37).timestamp_millis()),
            muted_on: Some(at(10, 0).date_naive()),
            ..Default::default()
        };
        let labels = tray_labels(
            &st,
            &at(10, 0),
            &TodayStats {
                total: 0,
                correct: 0,
            },
            "native",
        );
        assert_eq!(labels.pause, "恢复（还剩 37 分钟）");
        assert_eq!(labels.mute, "恢复弹出");
        assert_eq!(labels.today_line, "今日 0 题 · 正确率 —");
    }

    #[test]
    fn labels_follow_skin_copy() {
        let st = SchedulerState {
            next_at: Some(at(10, 5).timestamp_millis()),
            ..Default::default()
        };
        let labels = tray_labels(
            &st,
            &at(10, 0),
            &TodayStats {
                total: 3,
                correct: 3,
            },
            "terminal",
        );
        assert_eq!(labels.next_line, "next in ~5 分钟");
        assert_eq!(labels.today_line, "today 3 · acc 100%");
    }

    #[test]
    fn day_start_is_local_midnight() {
        assert_eq!(
            day_start(&at(10, 30)),
            Utc.with_ymd_and_hms(2026, 11, 12, 0, 0, 0)
                .unwrap()
                .timestamp_millis()
        );
    }
}
