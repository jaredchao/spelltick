//! Built-in decks bundled into the binary and imported on startup.

use rusqlite::{Connection, OptionalExtension, Result, params};
use serde::Deserialize;

#[derive(Debug, Deserialize)]
struct DeckFile {
    name: String,
    items: Vec<DeckItem>,
}

#[derive(Debug, Deserialize)]
struct DeckItem {
    term: String,
    meaning: String,
    phonetic: Option<String>,
    pos: Option<String>,
    example: Option<String>,
}

pub struct BuiltinDeck {
    pub key: &'static str,
    /// Bump when the JSON changes so existing installs re-import it.
    pub version: u32,
    pub json: &'static str,
}

pub const BUILTIN_DECKS: &[BuiltinDeck] = &[
    BuiltinDeck {
        key: "cet",
        version: 1,
        json: include_str!("../../data/cet.json"),
    },
    BuiltinDeck {
        key: "programmer",
        version: 1,
        json: include_str!("../../data/programmer.json"),
    },
];

pub fn kind_of(term: &str) -> &'static str {
    if term.trim().contains(char::is_whitespace) {
        "sentence"
    } else {
        "word"
    }
}

fn version_key(key: &str) -> String {
    format!("builtin.{key}.version")
}

/// Import or update every built-in deck whose stored version differs.
/// Existing items keep their id (and therefore their review history).
pub fn seed_builtin(conn: &mut Connection, decks: &[BuiltinDeck], now: i64) -> Result<()> {
    for deck in decks {
        let stored: Option<String> = conn
            .query_row(
                "SELECT value FROM settings WHERE key = ?1",
                [version_key(deck.key)],
                |r| r.get(0),
            )
            .optional()?;
        if stored.as_deref() == Some(deck.version.to_string().as_str()) {
            continue;
        }
        let file: DeckFile = serde_json::from_str(deck.json)
            .map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;
        import_deck(conn, deck, &file, now)?;
    }
    Ok(())
}

fn import_deck(conn: &mut Connection, deck: &BuiltinDeck, file: &DeckFile, now: i64) -> Result<()> {
    let tx = conn.transaction()?;
    tx.execute(
        "INSERT INTO decks (name, source, enabled, created_at, builtin_key)
         VALUES (?1, 'builtin', 1, ?2, ?3)
         ON CONFLICT(builtin_key) WHERE builtin_key IS NOT NULL DO UPDATE SET name = excluded.name",
        params![file.name, now, deck.key],
    )?;
    let deck_id: i64 = tx.query_row(
        "SELECT id FROM decks WHERE builtin_key = ?1",
        [deck.key],
        |r| r.get(0),
    )?;
    {
        let mut stmt = tx.prepare(
            "INSERT INTO items (deck_id, kind, term, meaning, phonetic, pos, example)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
             ON CONFLICT(deck_id, term) DO UPDATE SET
               kind = excluded.kind, meaning = excluded.meaning, phonetic = excluded.phonetic,
               pos = excluded.pos,
               example = CASE WHEN excluded.example IS NOT NULL THEN excluded.example ELSE items.example END,
               example_ai = CASE WHEN excluded.example IS NOT NULL THEN 0 ELSE items.example_ai END",
        )?;
        for item in &file.items {
            let term = item.term.trim();
            stmt.execute(params![
                deck_id,
                kind_of(term),
                term,
                item.meaning.trim(),
                item.phonetic,
                item.pos,
                item.example,
            ])?;
        }
    }
    tx.execute(
        "INSERT INTO settings (key, value) VALUES (?1, ?2)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        params![version_key(deck.key), deck.version.to_string()],
    )?;
    tx.commit()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::migrations::migrate;

    const SAMPLE_V1: &str = r#"{"name":"测试","items":[
        {"term":"deploy","meaning":"部署","pos":"v."},
        {"term":"Ship it.","meaning":"发布吧。","example":null}
    ]}"#;
    const SAMPLE_V2: &str = r#"{"name":"测试2","items":[
        {"term":"deploy","meaning":"部署；展开","pos":"v.","example":"We deploy daily."}
    ]}"#;

    fn conn() -> Connection {
        let mut c = Connection::open_in_memory().unwrap();
        migrate(&mut c).unwrap();
        c
    }

    fn count(c: &Connection, sql: &str) -> i64 {
        c.query_row(sql, [], |r| r.get(0)).unwrap()
    }

    #[test]
    fn detects_sentences_by_whitespace() {
        assert_eq!(kind_of("deploy"), "word");
        assert_eq!(kind_of("Ship it."), "sentence");
    }

    #[test]
    fn imports_once_per_version() {
        let mut c = conn();
        let decks = [BuiltinDeck {
            key: "t",
            version: 1,
            json: SAMPLE_V1,
        }];
        seed_builtin(&mut c, &decks, 1).unwrap();
        seed_builtin(&mut c, &decks, 2).unwrap();
        assert_eq!(count(&c, "SELECT COUNT(*) FROM decks"), 1);
        assert_eq!(count(&c, "SELECT COUNT(*) FROM items"), 2);
        assert_eq!(
            count(&c, "SELECT COUNT(*) FROM items WHERE kind = 'sentence'"),
            1
        );
    }

    #[test]
    fn new_version_updates_items_in_place() {
        let mut c = conn();
        seed_builtin(
            &mut c,
            &[BuiltinDeck {
                key: "t",
                version: 1,
                json: SAMPLE_V1,
            }],
            1,
        )
        .unwrap();
        let id_before = count(&c, "SELECT id FROM items WHERE term = 'deploy'");
        seed_builtin(
            &mut c,
            &[BuiltinDeck {
                key: "t",
                version: 2,
                json: SAMPLE_V2,
            }],
            2,
        )
        .unwrap();
        let id_after = count(&c, "SELECT id FROM items WHERE term = 'deploy'");
        assert_eq!(id_before, id_after);
        let meaning: String = c
            .query_row("SELECT meaning FROM items WHERE term = 'deploy'", [], |r| {
                r.get(0)
            })
            .unwrap();
        assert_eq!(meaning, "部署；展开");
        let name: String = c
            .query_row("SELECT name FROM decks", [], |r| r.get(0))
            .unwrap();
        assert_eq!(name, "测试2");
    }

    #[test]
    fn bundled_decks_parse() {
        for deck in BUILTIN_DECKS {
            let file: DeckFile = serde_json::from_str(deck.json).unwrap();
            assert!(!file.items.is_empty(), "deck {} is empty", deck.key);
        }
    }
}
