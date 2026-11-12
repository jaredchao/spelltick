//! Skin copy needed on the Rust side (tray status lines). Reads the same
//! `docs/design/skins.json` the frontend uses.

use std::{collections::HashMap, sync::OnceLock};

use serde::Deserialize;

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TrayCopy {
    pub tray_next: String,
    pub tray_today: String,
}

#[derive(Debug, Deserialize)]
struct SkinEntry {
    copy: TrayCopy,
}

fn skins() -> &'static HashMap<String, SkinEntry> {
    static SKINS: OnceLock<HashMap<String, SkinEntry>> = OnceLock::new();
    SKINS.get_or_init(|| {
        serde_json::from_str(include_str!("../../docs/design/skins.json"))
            .expect("docs/design/skins.json must be valid")
    })
}

/// Tray copy for a concrete skin id; unknown ids fall back to `native`.
pub fn tray_copy(skin_id: &str) -> &'static TrayCopy {
    let all = skins();
    all.get(skin_id)
        .or_else(|| all.get("native"))
        .map(|s| &s.copy)
        .expect("native skin must exist")
}

pub fn fill(template: &str, pairs: &[(&str, &str)]) -> String {
    pairs
        .iter()
        .fold(template.to_string(), |acc, (key, value)| {
            acc.replace(&format!("{{{key}}}"), value)
        })
}

/// Same rules as `src/core/duration.ts`.
pub fn format_duration(ms: i64) -> String {
    const MINUTE: i64 = 60_000;
    const HOUR: i64 = 60 * MINUTE;
    const DAY: i64 = 24 * HOUR;
    let round = |v: i64, unit: i64| (v as f64 / unit as f64).round() as i64;
    if round(ms, MINUTE) < 60 {
        format!("{} 分钟", round(ms, MINUTE).max(1))
    } else if round(ms, HOUR) < 24 {
        format!("{} 小时", round(ms, HOUR).max(1))
    } else {
        format!("{} 天", round(ms, DAY).max(1))
    }
}

pub fn format_rate(correct: i64, total: i64) -> String {
    if total <= 0 {
        "—".into()
    } else {
        format!(
            "{}%",
            ((correct as f64 / total as f64) * 100.0).round() as i64
        )
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reads_all_three_skins() {
        assert_eq!(tray_copy("native").tray_next, "下一题约 {time}后");
        assert_eq!(tray_copy("terminal").tray_next, "next in ~{time}");
        assert!(tray_copy("paper").tray_today.contains("{n}"));
    }

    #[test]
    fn unknown_skin_falls_back_to_native() {
        assert_eq!(tray_copy("nope").tray_next, tray_copy("native").tray_next);
    }

    #[test]
    fn fills_templates() {
        let s = fill(
            "今日 {n} 题 · 正确率 {rate}",
            &[("n", "18"), ("rate", "83%")],
        );
        assert_eq!(s, "今日 18 题 · 正确率 83%");
    }

    #[test]
    fn formats_durations_like_frontend() {
        assert_eq!(format_duration(12 * 60_000), "12 分钟");
        assert_eq!(format_duration(10_000), "1 分钟");
        assert_eq!(format_duration(3 * 3_600_000), "3 小时");
        assert_eq!(format_duration(2 * 86_400_000), "2 天");
        assert_eq!(format_duration(86_400_000 - 60_000), "1 天");
        assert_eq!(format_duration(59 * 60_000 + 40_000), "1 小时");
    }

    #[test]
    fn formats_rate() {
        assert_eq!(format_rate(15, 18), "83%");
        assert_eq!(format_rate(0, 0), "—");
    }
}
