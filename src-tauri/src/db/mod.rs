//! SQLite storage. One connection guarded by a mutex; the app is single-user.

pub mod commands;
pub mod decks;
pub mod migrations;
pub mod progress;
pub mod quiz;
pub mod seed;

use std::{path::Path, sync::Mutex};

use rusqlite::Connection;

pub struct Db(pub Mutex<Connection>);

pub const FILE_NAME: &str = "spell.db";

pub fn open(path: &Path, now: i64) -> rusqlite::Result<Connection> {
    let mut conn = Connection::open(path)?;
    conn.pragma_update(None, "journal_mode", "WAL")?;
    conn.pragma_update(None, "foreign_keys", "ON")?;
    migrations::migrate(&mut conn)?;
    seed::seed_builtin(&mut conn, seed::BUILTIN_DECKS, now)?;
    Ok(conn)
}

pub fn now_ms() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}
