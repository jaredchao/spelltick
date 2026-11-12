//! Scheduling rules (SPEC section 5), free of Tauri and OS calls so they can
//! be unit-tested with fixed clocks. Times are unix milliseconds; local
//! wall-clock rules (work hours, "today") use the timezone of the `DateTime`.

use chrono::{DateTime, Duration, NaiveDate, NaiveTime, TimeZone};

use crate::settings::{IntervalMode, ScheduleSettings};

pub const MINUTE_MS: i64 = 60_000;
/// DND (fullscreen) blocked: check again after 5 minutes.
pub const DND_RETRY_MS: i64 = 5 * MINUTE_MS;
/// User typing: check again after 60 seconds, at most 5 times.
pub const TYPING_RETRY_MS: i64 = 60_000;
pub const MAX_TYPING_DEFERRALS: u32 = 5;
pub const TYPING_IDLE_SECS: f64 = 3.0;
/// A peek that timed out comes back after 5 to 10 minutes.
pub const RETRY_MIN_MS: i64 = 5 * MINUTE_MS;
pub const RETRY_MAX_MS: i64 = 10 * MINUTE_MS;
pub const PAUSE_MS: i64 = 60 * MINUTE_MS;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Retry {
    pub item_id: i64,
    pub at: i64,
}

#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct SchedulerState {
    pub next_at: Option<i64>,
    pub paused_until: Option<i64>,
    pub muted_on: Option<NaiveDate>,
    pub typing_deferrals: u32,
    pub retry: Option<Retry>,
}

/// What the OS says right now; only queried when a popup is due.
pub trait Probe {
    fn fullscreen_app_active(&self) -> bool;
    fn seconds_since_last_input(&self) -> f64;
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CloseReason {
    /// Peek ignored for 30 s: not graded, ask the same item again later.
    Timeout,
    /// Answered, skipped, or otherwise finished.
    Done,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Fire {
    pub retry_item: Option<i64>,
}

fn parse_hm(s: &str) -> Option<NaiveTime> {
    NaiveTime::parse_from_str(s.trim(), "%H:%M").ok()
}

/// Random delay in [min, max] minutes, or the fixed interval. `rng` is in [0, 1).
pub fn interval_ms(s: &ScheduleSettings, rng: f64) -> i64 {
    match s.mode {
        IntervalMode::Fixed => i64::from(s.fixed_minutes.max(1)) * MINUTE_MS,
        IntervalMode::Random => {
            let lo = i64::from(s.min_minutes.min(s.max_minutes).max(1)) * MINUTE_MS;
            let hi = i64::from(s.max_minutes.max(s.min_minutes).max(1)) * MINUTE_MS;
            lo + ((hi - lo) as f64 * rng.clamp(0.0, 1.0)) as i64
        }
    }
}

fn at_time<Tz: TimeZone>(tz: &Tz, date: NaiveDate, time: NaiveTime) -> Option<DateTime<Tz>> {
    tz.from_local_datetime(&date.and_time(time)).earliest()
}

/// Whether `now` falls inside work hours (supports ranges past midnight).
pub fn in_work_hours<Tz: TimeZone>(s: &ScheduleSettings, now: &DateTime<Tz>) -> bool {
    if !s.work_hours_enabled {
        return true;
    }
    let (Some(start), Some(end)) = (parse_hm(&s.work_start), parse_hm(&s.work_end)) else {
        return true;
    };
    let t = now.time();
    if start <= end {
        t >= start && t < end
    } else {
        t >= start || t < end
    }
}

/// The next moment work hours start, strictly after `now`'s current block.
pub fn next_work_start<Tz: TimeZone>(s: &ScheduleSettings, now: &DateTime<Tz>) -> DateTime<Tz> {
    let start = parse_hm(&s.work_start).unwrap_or(NaiveTime::MIN);
    let tz = now.timezone();
    let today = now.date_naive();
    match at_time(&tz, today, start) {
        Some(t) if t > *now => t,
        _ => at_time(&tz, today + Duration::days(1), start)
            .unwrap_or_else(|| now.clone() + Duration::days(1)),
    }
}

fn start_of_next_day<Tz: TimeZone>(s: &ScheduleSettings, now: &DateTime<Tz>) -> DateTime<Tz> {
    let tz = now.timezone();
    let tomorrow = now.date_naive() + Duration::days(1);
    let time = if s.work_hours_enabled {
        parse_hm(&s.work_start).unwrap_or(NaiveTime::MIN)
    } else {
        NaiveTime::MIN
    };
    at_time(&tz, tomorrow, time).unwrap_or_else(|| now.clone() + Duration::days(1))
}

impl SchedulerState {
    /// If popping up at `t` is blocked by pause, "not today" or work hours,
    /// the time (ms) when that block ends. Pause and mute win over work hours.
    pub fn blocked_until<Tz: TimeZone>(
        &self,
        s: &ScheduleSettings,
        t: &DateTime<Tz>,
    ) -> Option<i64> {
        let ms = t.timestamp_millis();
        if let Some(until) = self.paused_until.filter(|&u| u > ms) {
            return Some(until);
        }
        if self.muted_on == Some(t.date_naive()) {
            return Some(start_of_next_day(s, t).timestamp_millis());
        }
        if !in_work_hours(s, t) {
            return Some(next_work_start(s, t).timestamp_millis());
        }
        None
    }

    /// Next popup time from `from`: one interval later, moved past any block.
    fn schedule_from<Tz: TimeZone>(
        &self,
        s: &ScheduleSettings,
        from: &DateTime<Tz>,
        rng: f64,
    ) -> i64 {
        let tz = from.timezone();
        let mut t = from.timestamp_millis() + interval_ms(s, rng);
        for _ in 0..4 {
            let at = tz
                .timestamp_millis_opt(t)
                .single()
                .unwrap_or_else(|| from.clone());
            match self.blocked_until(s, &at) {
                Some(until) => t = until + interval_ms(s, rng),
                None => break,
            }
        }
        t
    }

    pub fn due_at(&self) -> Option<i64> {
        match (self.next_at, self.retry.map(|r| r.at)) {
            (Some(a), Some(b)) => Some(a.min(b)),
            (a, b) => a.or(b),
        }
    }

    /// Called every tick. Returns `Some(Fire)` when the popup should show now.
    pub fn tick<Tz: TimeZone>(
        &mut self,
        s: &ScheduleSettings,
        now: &DateTime<Tz>,
        popup_visible: bool,
        probe: &dyn Probe,
        rng: f64,
    ) -> Option<Fire> {
        let now_ms = now.timestamp_millis();
        if self.next_at.is_none() {
            self.next_at = Some(self.schedule_from(s, now, rng));
        }
        if popup_visible {
            return None;
        }
        let due = self.due_at()?;
        if now_ms < due {
            return None;
        }

        if let Some(until) = self.blocked_until(s, now) {
            // A timed-out item is dropped when blocked; it is still new and will come back.
            self.retry = None;
            self.typing_deferrals = 0;
            let tz = now.timezone();
            let from = tz
                .timestamp_millis_opt(until)
                .single()
                .unwrap_or_else(|| now.clone());
            self.next_at = Some(self.schedule_from(s, &from, rng).max(until));
            return None;
        }

        let retry_due = self.retry.filter(|r| r.at <= now_ms);
        let push = |state: &mut Self, at: i64| match retry_due {
            Some(r) => state.retry = Some(Retry { at, ..r }),
            None => state.next_at = Some(at),
        };

        if s.skip_fullscreen && probe.fullscreen_app_active() {
            push(self, now_ms + DND_RETRY_MS);
            return None;
        }
        if s.defer_when_typing
            && self.typing_deferrals < MAX_TYPING_DEFERRALS
            && probe.seconds_since_last_input() < TYPING_IDLE_SECS
        {
            self.typing_deferrals += 1;
            push(self, now_ms + TYPING_RETRY_MS);
            return None;
        }

        self.typing_deferrals = 0;
        self.retry = None;
        // Provisional; replaced when the popup closes.
        self.next_at = Some(self.schedule_from(s, now, rng));
        Some(Fire {
            retry_item: retry_due.map(|r| r.item_id),
        })
    }

    /// The popup was closed: restart the interval, and remember a timed-out item.
    pub fn on_closed<Tz: TimeZone>(
        &mut self,
        s: &ScheduleSettings,
        now: &DateTime<Tz>,
        reason: CloseReason,
        item_id: Option<i64>,
        rng: f64,
    ) {
        self.next_at = Some(self.schedule_from(s, now, rng));
        self.retry = match (reason, item_id) {
            (CloseReason::Timeout, Some(item_id)) => Some(Retry {
                item_id,
                at: now.timestamp_millis()
                    + RETRY_MIN_MS
                    + ((RETRY_MAX_MS - RETRY_MIN_MS) as f64 * rng) as i64,
            }),
            _ => None,
        };
    }

    pub fn pause<Tz: TimeZone>(&mut self, s: &ScheduleSettings, now: &DateTime<Tz>, rng: f64) {
        self.paused_until = Some(now.timestamp_millis() + PAUSE_MS);
        self.retry = None;
        self.next_at = Some(self.schedule_from(s, now, rng));
    }

    pub fn mute_today<Tz: TimeZone>(&mut self, s: &ScheduleSettings, now: &DateTime<Tz>, rng: f64) {
        self.muted_on = Some(now.date_naive());
        self.retry = None;
        self.next_at = Some(self.schedule_from(s, now, rng));
    }

    /// Clear pause and "not today", then schedule from now.
    pub fn resume<Tz: TimeZone>(&mut self, s: &ScheduleSettings, now: &DateTime<Tz>, rng: f64) {
        self.paused_until = None;
        self.muted_on = None;
        self.next_at = Some(self.schedule_from(s, now, rng));
    }

    /// Settings changed: reschedule from now (keeps pause / mute).
    pub fn reschedule<Tz: TimeZone>(&mut self, s: &ScheduleSettings, now: &DateTime<Tz>, rng: f64) {
        self.next_at = Some(self.schedule_from(s, now, rng));
    }

    pub fn is_paused(&self, now_ms: i64) -> bool {
        self.paused_until.is_some_and(|u| u > now_ms)
    }

    pub fn is_muted<Tz: TimeZone>(&self, now: &DateTime<Tz>) -> bool {
        self.muted_on == Some(now.date_naive())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::Utc;

    struct FakeProbe {
        fullscreen: bool,
        idle: f64,
    }
    impl Probe for FakeProbe {
        fn fullscreen_app_active(&self) -> bool {
            self.fullscreen
        }
        fn seconds_since_last_input(&self) -> f64 {
            self.idle
        }
    }
    const IDLE: FakeProbe = FakeProbe {
        fullscreen: false,
        idle: 100.0,
    };

    fn at(h: u32, m: u32) -> DateTime<Utc> {
        Utc.with_ymd_and_hms(2026, 11, 12, h, m, 0).unwrap()
    }
    fn plus(t: &DateTime<Utc>, ms: i64) -> DateTime<Utc> {
        Utc.timestamp_millis_opt(t.timestamp_millis() + ms).unwrap()
    }
    fn fixed(minutes: u32) -> ScheduleSettings {
        ScheduleSettings {
            mode: IntervalMode::Fixed,
            fixed_minutes: minutes,
            ..Default::default()
        }
    }

    #[test]
    fn random_interval_spans_min_to_max() {
        let s = ScheduleSettings::default();
        assert_eq!(interval_ms(&s, 0.0), 15 * MINUTE_MS);
        assert_eq!(interval_ms(&s, 1.0), 45 * MINUTE_MS);
        assert_eq!(interval_ms(&s, 0.5), 30 * MINUTE_MS);
    }

    #[test]
    fn fixed_interval_ignores_rng() {
        assert_eq!(interval_ms(&fixed(30), 0.9), 30 * MINUTE_MS);
    }

    #[test]
    fn work_hours_bounds() {
        let s = ScheduleSettings::default();
        assert!(!in_work_hours(&s, &at(8, 59)));
        assert!(in_work_hours(&s, &at(9, 0)));
        assert!(in_work_hours(&s, &at(17, 59)));
        assert!(!in_work_hours(&s, &at(18, 0)));
    }

    #[test]
    fn work_hours_past_midnight() {
        let s = ScheduleSettings {
            work_start: "22:00".into(),
            work_end: "02:00".into(),
            ..Default::default()
        };
        assert!(in_work_hours(&s, &at(23, 0)));
        assert!(in_work_hours(&s, &at(1, 0)));
        assert!(!in_work_hours(&s, &at(12, 0)));
    }

    #[test]
    fn work_hours_disabled_always_open() {
        let s = ScheduleSettings {
            work_hours_enabled: false,
            ..Default::default()
        };
        assert!(in_work_hours(&s, &at(3, 0)));
    }

    #[test]
    fn next_work_start_is_today_or_tomorrow() {
        let s = ScheduleSettings::default();
        assert_eq!(next_work_start(&s, &at(7, 0)), at(9, 0));
        assert_eq!(
            next_work_start(&s, &at(19, 0)),
            plus(&at(9, 0), 24 * 60 * MINUTE_MS)
        );
    }

    #[test]
    fn first_tick_schedules_one_interval_ahead() {
        let s = fixed(30);
        let mut st = SchedulerState::default();
        assert_eq!(st.tick(&s, &at(10, 0), false, &IDLE, 0.0), None);
        assert_eq!(st.next_at, Some(at(10, 30).timestamp_millis()));
    }

    #[test]
    fn fires_when_due_and_reschedules() {
        let s = fixed(30);
        let mut st = SchedulerState::default();
        st.tick(&s, &at(10, 0), false, &IDLE, 0.0);
        assert_eq!(st.tick(&s, &at(10, 29), false, &IDLE, 0.0), None);
        assert_eq!(
            st.tick(&s, &at(10, 30), false, &IDLE, 0.0),
            Some(Fire { retry_item: None })
        );
        assert_eq!(st.next_at, Some(at(11, 0).timestamp_millis()));
    }

    #[test]
    fn does_not_fire_while_popup_visible() {
        let s = fixed(30);
        let mut st = SchedulerState {
            next_at: Some(at(10, 0).timestamp_millis()),
            ..Default::default()
        };
        assert_eq!(st.tick(&s, &at(10, 5), true, &IDLE, 0.0), None);
    }

    #[test]
    fn outside_work_hours_waits_for_next_start() {
        let s = fixed(30);
        let mut st = SchedulerState::default();
        st.tick(&s, &at(17, 45), false, &IDLE, 0.0);
        // 18:15 is outside work hours -> 09:00 tomorrow + 30 min
        let expected = plus(&at(9, 30), 24 * 60 * MINUTE_MS).timestamp_millis();
        assert_eq!(st.next_at, Some(expected));
    }

    #[test]
    fn fullscreen_defers_five_minutes() {
        let s = fixed(30);
        let mut st = SchedulerState {
            next_at: Some(at(10, 0).timestamp_millis()),
            ..Default::default()
        };
        let busy = FakeProbe {
            fullscreen: true,
            idle: 100.0,
        };
        assert_eq!(st.tick(&s, &at(10, 0), false, &busy, 0.0), None);
        assert_eq!(st.next_at, Some(at(10, 5).timestamp_millis()));
    }

    #[test]
    fn fullscreen_ignored_when_setting_off() {
        let s = ScheduleSettings {
            skip_fullscreen: false,
            ..fixed(30)
        };
        let mut st = SchedulerState {
            next_at: Some(at(10, 0).timestamp_millis()),
            ..Default::default()
        };
        let busy = FakeProbe {
            fullscreen: true,
            idle: 100.0,
        };
        assert!(st.tick(&s, &at(10, 0), false, &busy, 0.0).is_some());
    }

    #[test]
    fn typing_defers_up_to_five_times_then_fires() {
        let s = fixed(30);
        let typing = FakeProbe {
            fullscreen: false,
            idle: 0.5,
        };
        let mut st = SchedulerState {
            next_at: Some(at(10, 0).timestamp_millis()),
            ..Default::default()
        };
        let mut now = at(10, 0);
        for i in 1..=5 {
            assert_eq!(st.tick(&s, &now, false, &typing, 0.0), None, "deferral {i}");
            now = plus(&now, TYPING_RETRY_MS);
        }
        assert!(st.tick(&s, &now, false, &typing, 0.0).is_some());
        assert_eq!(st.typing_deferrals, 0);
    }

    #[test]
    fn pause_blocks_for_one_hour() {
        let s = fixed(30);
        let mut st = SchedulerState::default();
        st.pause(&s, &at(10, 0), 0.0);
        assert!(st.is_paused(at(10, 59).timestamp_millis()));
        assert_eq!(st.next_at, Some(at(11, 30).timestamp_millis()));
        assert_eq!(st.tick(&s, &at(10, 30), false, &IDLE, 0.0), None);
    }

    #[test]
    fn mute_today_moves_to_tomorrow() {
        let s = fixed(30);
        let mut st = SchedulerState::default();
        st.mute_today(&s, &at(10, 0), 0.0);
        assert!(st.is_muted(&at(15, 0)));
        let expected = plus(&at(9, 30), 24 * 60 * MINUTE_MS).timestamp_millis();
        assert_eq!(st.next_at, Some(expected));
    }

    #[test]
    fn resume_clears_pause_and_mute() {
        let s = fixed(30);
        let mut st = SchedulerState::default();
        st.pause(&s, &at(10, 0), 0.0);
        st.mute_today(&s, &at(10, 0), 0.0);
        st.resume(&s, &at(10, 10), 0.0);
        assert!(!st.is_paused(at(10, 11).timestamp_millis()));
        assert!(!st.is_muted(&at(10, 11)));
        assert_eq!(st.next_at, Some(at(10, 40).timestamp_millis()));
    }

    #[test]
    fn timeout_retries_same_item_in_five_to_ten_minutes() {
        let s = fixed(30);
        let mut st = SchedulerState::default();
        st.on_closed(&s, &at(10, 0), CloseReason::Timeout, Some(42), 0.0);
        assert_eq!(
            st.retry,
            Some(Retry {
                item_id: 42,
                at: at(10, 5).timestamp_millis()
            })
        );
        assert_eq!(
            st.tick(&s, &at(10, 5), false, &IDLE, 0.0),
            Some(Fire {
                retry_item: Some(42)
            })
        );
        assert_eq!(st.retry, None);
    }

    #[test]
    fn retry_window_upper_bound() {
        let s = fixed(30);
        let mut st = SchedulerState::default();
        st.on_closed(&s, &at(10, 0), CloseReason::Timeout, Some(1), 1.0);
        assert_eq!(st.retry.unwrap().at, at(10, 10).timestamp_millis());
    }

    #[test]
    fn answered_close_has_no_retry() {
        let s = fixed(30);
        let mut st = SchedulerState::default();
        st.on_closed(&s, &at(10, 0), CloseReason::Done, Some(42), 0.0);
        assert_eq!(st.retry, None);
        assert_eq!(st.next_at, Some(at(10, 30).timestamp_millis()));
    }

    #[test]
    fn retry_dropped_when_blocked() {
        let s = fixed(30);
        let mut st = SchedulerState::default();
        st.on_closed(&s, &at(17, 55), CloseReason::Timeout, Some(42), 0.0);
        assert_eq!(st.tick(&s, &at(18, 0), false, &IDLE, 0.0), None);
        assert_eq!(st.retry, None);
    }
}
