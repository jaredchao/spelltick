//! Schema migrations tracked by `PRAGMA user_version`.
//! Never edit a released migration; append a new one instead.

use rusqlite::{Connection, Result};

/// Index `i` upgrades the schema from version `i` to `i + 1`.
const MIGRATIONS: &[&str] = &[
    // 1: base schema (SPEC section 12)
    r#"
    CREATE TABLE decks (
      id          INTEGER PRIMARY KEY,
      name        TEXT NOT NULL,
      source      TEXT NOT NULL CHECK (source IN ('builtin','imported','user')),
      enabled     INTEGER NOT NULL DEFAULT 1,
      created_at  INTEGER NOT NULL
    );

    CREATE TABLE items (
      id          INTEGER PRIMARY KEY,
      deck_id     INTEGER NOT NULL REFERENCES decks(id) ON DELETE CASCADE,
      kind        TEXT NOT NULL CHECK (kind IN ('word','sentence')),
      term        TEXT NOT NULL,
      meaning     TEXT NOT NULL,
      phonetic    TEXT,
      pos         TEXT,
      example     TEXT,
      example_ai  INTEGER NOT NULL DEFAULT 0,
      UNIQUE (deck_id, term)
    );

    CREATE TABLE reviews (
      item_id       INTEGER PRIMARY KEY REFERENCES items(id) ON DELETE CASCADE,
      ease          REAL    NOT NULL DEFAULT 2.5,
      interval_days REAL    NOT NULL DEFAULT 0,
      reps          INTEGER NOT NULL DEFAULT 0,
      due_at        INTEGER NOT NULL,
      last_result   TEXT,
      lapses        INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE attempts (
      id          INTEGER PRIMARY KEY,
      item_id     INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
      quiz_type   TEXT NOT NULL,
      answer      TEXT NOT NULL,
      correct     INTEGER NOT NULL,
      used_hint   INTEGER NOT NULL DEFAULT 0,
      at          INTEGER NOT NULL
    );

    CREATE TABLE settings (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
    "#,
    // 2: first-answer time for the daily new-item cap; stable key for built-in decks
    r#"
    ALTER TABLE reviews ADD COLUMN created_at INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE decks ADD COLUMN builtin_key TEXT;
    CREATE UNIQUE INDEX idx_decks_builtin_key ON decks(builtin_key) WHERE builtin_key IS NOT NULL;
    CREATE INDEX idx_reviews_due ON reviews(due_at);
    CREATE INDEX idx_reviews_created ON reviews(created_at);
    CREATE INDEX idx_attempts_at ON attempts(at);
    CREATE INDEX idx_attempts_item ON attempts(item_id);
    "#,
];

pub fn current_version(conn: &Connection) -> Result<usize> {
    conn.query_row("PRAGMA user_version", [], |row| row.get::<_, i64>(0))
        .map(|v| v as usize)
}

#[cfg(test)]
pub fn latest_version() -> usize {
    MIGRATIONS.len()
}

/// Apply all pending migrations, each in its own transaction.
pub fn migrate(conn: &mut Connection) -> Result<()> {
    let from = current_version(conn)?;
    for (index, sql) in MIGRATIONS.iter().enumerate().skip(from) {
        let tx = conn.transaction()?;
        tx.execute_batch(sql)?;
        tx.pragma_update(None, "user_version", (index + 1) as i64)?;
        tx.commit()?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn migrates_fresh_database_to_latest() {
        let mut conn = Connection::open_in_memory().unwrap();
        migrate(&mut conn).unwrap();
        assert_eq!(current_version(&conn).unwrap(), latest_version());
    }

    #[test]
    fn migrate_is_idempotent() {
        let mut conn = Connection::open_in_memory().unwrap();
        migrate(&mut conn).unwrap();
        migrate(&mut conn).unwrap();
        assert_eq!(current_version(&conn).unwrap(), latest_version());
    }

    #[test]
    fn upgrades_from_version_one() {
        let mut conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(MIGRATIONS[0]).unwrap();
        conn.pragma_update(None, "user_version", 1).unwrap();
        conn.execute(
            "INSERT INTO decks (name, source, created_at) VALUES ('x', 'user', 1)",
            [],
        )
        .unwrap();
        migrate(&mut conn).unwrap();
        let count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM decks WHERE builtin_key IS NULL",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(count, 1);
    }
}
