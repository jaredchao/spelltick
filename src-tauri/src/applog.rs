//! Local log file for silent failures (AI timeouts, network errors).
//! Callers must never pass secrets; words that look like an `sk-` key are
//! also scrubbed as a safety net.

use std::{fs::OpenOptions, io::Write, path::PathBuf};

use tauri::{AppHandle, Manager, Runtime};

const FILE_NAME: &str = "spell.log";
const MAX_BYTES: u64 = 1024 * 1024;

fn log_path<R: Runtime>(app: &AppHandle<R>) -> Option<PathBuf> {
    let dir = app.path().app_log_dir().ok()?;
    std::fs::create_dir_all(&dir).ok()?;
    Some(dir.join(FILE_NAME))
}

/// Replace words that look like an API key (`sk-...`) with a placeholder.
pub fn scrub(message: &str) -> String {
    message
        .split_whitespace()
        .map(|word| {
            let lower = word.to_ascii_lowercase();
            if lower.starts_with("sk-") && word.len() > 8 {
                "[redacted]"
            } else {
                word
            }
        })
        .collect::<Vec<_>>()
        .join(" ")
}

pub fn write<R: Runtime>(app: &AppHandle<R>, level: &str, message: &str) {
    let Some(path) = log_path(app) else { return };
    if std::fs::metadata(&path).is_ok_and(|m| m.len() > MAX_BYTES) {
        let _ = std::fs::rename(&path, path.with_extension("log.old"));
    }
    let line = format!(
        "{} [{}] {}\n",
        chrono::Local::now().format("%Y-%m-%d %H:%M:%S"),
        level,
        scrub(message)
    );
    if let Ok(mut file) = OpenOptions::new().create(true).append(true).open(&path) {
        let _ = file.write_all(line.as_bytes());
    }
}

#[tauri::command]
pub fn log_write<R: Runtime>(app: AppHandle<R>, level: String, message: String) {
    write(&app, &level, &message);
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn scrubs_keys() {
        assert_eq!(
            scrub("auth failed sk-abcdef123456"),
            "auth failed [redacted]"
        );
        assert_eq!(scrub("timeout after 10s"), "timeout after 10s");
    }
}
