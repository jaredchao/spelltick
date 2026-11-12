//! Learning progress export / import (SPEC section 11): custom decks, review
//! records and settings. Never contains the API key (it lives in the keychain).

use rusqlite::{Connection, OptionalExtension, Result, params};
use serde::{Deserialize, Serialize};

use super::decks::{NewItem, insert_items};
use crate::settings::{self, Settings};

pub const FORMAT: &str = "english-spell-progress";
pub const VERSION: u32 = 1;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct DeckExport {
    /// "builtin:<key>" or "deck:<n>"; reviews point at decks through this.
    pub r#ref: String,
    pub name: String,
    pub source: String,
    pub enabled: bool,
    pub created_at: i64,
    /// Empty for built-in decks (their items ship with the app).
    pub items: Vec<NewItem>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ReviewExport {
    pub deck_ref: String,
    pub term: String,
    pub ease: f64,
    pub interval_days: f64,
    pub reps: i64,
    pub due_at: i64,
    pub last_result: Option<String>,
    pub lapses: i64,
    pub created_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ProgressFile {
    pub format: String,
    pub version: u32,
    pub exported_at: i64,
    pub settings: Settings,
    pub decks: Vec<DeckExport>,
    pub reviews: Vec<ReviewExport>,
}

struct DeckRow {
    id: i64,
    name: String,
    source: String,
    enabled: bool,
    created_at: i64,
    builtin_key: Option<String>,
}

fn deck_rows(conn: &Connection) -> Result<Vec<DeckRow>> {
    let mut stmt = conn.prepare(
        "SELECT id, name, source, enabled, created_at, builtin_key FROM decks ORDER BY id",
    )?;
    let rows = stmt.query_map([], |r| {
        Ok(DeckRow {
            id: r.get(0)?,
            name: r.get(1)?,
            source: r.get(2)?,
            enabled: r.get(3)?,
            created_at: r.get(4)?,
            builtin_key: r.get(5)?,
        })
    })?;
    rows.collect()
}

fn deck_items(conn: &Connection, deck_id: i64) -> Result<Vec<NewItem>> {
    let mut stmt = conn.prepare(
        "SELECT term, meaning, example, phonetic, pos FROM items WHERE deck_id = ?1 ORDER BY id",
    )?;
    let rows = stmt.query_map([deck_id], |r| {
        Ok(NewItem {
            term: r.get(0)?,
            meaning: r.get(1)?,
            example: r.get(2)?,
            phonetic: r.get(3)?,
            pos: r.get(4)?,
        })
    })?;
    rows.collect()
}

pub fn export(conn: &Connection, now: i64) -> Result<ProgressFile> {
    let rows = deck_rows(conn)?;
    let mut decks = Vec::with_capacity(rows.len());
    let mut refs = std::collections::HashMap::new();
    for (index, row) in rows.iter().enumerate() {
        let r#ref = match &row.builtin_key {
            Some(key) => format!("builtin:{key}"),
            None => format!("deck:{index}"),
        };
        refs.insert(row.id, r#ref.clone());
        let items = if row.builtin_key.is_some() {
            Vec::new()
        } else {
            deck_items(conn, row.id)?
        };
        decks.push(DeckExport {
            r#ref,
            name: row.name.clone(),
            source: row.source.clone(),
            enabled: row.enabled,
            created_at: row.created_at,
            items,
        });
    }

    let mut stmt = conn.prepare(
        "SELECT i.deck_id, i.term, r.ease, r.interval_days, r.reps, r.due_at, r.last_result,
                r.lapses, r.created_at
         FROM reviews r JOIN items i ON i.id = r.item_id ORDER BY r.item_id",
    )?;
    let reviews = stmt
        .query_map([], |r| {
            let deck_id: i64 = r.get(0)?;
            Ok(ReviewExport {
                deck_ref: refs.get(&deck_id).cloned().unwrap_or_default(),
                term: r.get(1)?,
                ease: r.get(2)?,
                interval_days: r.get(3)?,
                reps: r.get(4)?,
                due_at: r.get(5)?,
                last_result: r.get(6)?,
                lapses: r.get(7)?,
                created_at: r.get(8)?,
            })
        })?
        .collect::<Result<Vec<_>>>()?;

    Ok(ProgressFile {
        format: FORMAT.into(),
        version: VERSION,
        exported_at: now,
        settings: settings::load(conn)?,
        decks,
        reviews,
    })
}

#[derive(Debug, PartialEq)]
pub enum ImportError {
    BadFormat(String),
}

impl std::fmt::Display for ImportError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::BadFormat(m) => write!(f, "文件格式不对：{m}"),
        }
    }
}

pub fn parse(json: &str) -> std::result::Result<ProgressFile, ImportError> {
    let file: ProgressFile =
        serde_json::from_str(json).map_err(|e| ImportError::BadFormat(e.to_string()))?;
    if file.format != FORMAT {
        return Err(ImportError::BadFormat("不是学习进度文件".into()));
    }
    if file.version > VERSION {
        return Err(ImportError::BadFormat("文件来自更新的版本".into()));
    }
    Ok(file)
}

/// Replace custom decks, all reviews, attempts and settings with the file's content.
pub fn import(conn: &mut Connection, file: &ProgressFile) -> Result<()> {
    let tx = conn.transaction()?;
    tx.execute("DELETE FROM attempts", [])?;
    tx.execute("DELETE FROM reviews", [])?;
    tx.execute("DELETE FROM decks WHERE source != 'builtin'", [])?;

    let mut ids = std::collections::HashMap::new();
    for deck in &file.decks {
        if let Some(key) = deck.r#ref.strip_prefix("builtin:") {
            let id: Option<i64> = tx
                .query_row("SELECT id FROM decks WHERE builtin_key = ?1", [key], |r| {
                    r.get(0)
                })
                .optional()?;
            if let Some(id) = id {
                tx.execute(
                    "UPDATE decks SET enabled = ?1 WHERE id = ?2",
                    params![deck.enabled, id],
                )?;
                ids.insert(deck.r#ref.clone(), id);
            }
            continue;
        }
        let source = if deck.source == "user" {
            "user"
        } else {
            "imported"
        };
        tx.execute(
            "INSERT INTO decks (name, source, enabled, created_at) VALUES (?1, ?2, ?3, ?4)",
            params![deck.name, source, deck.enabled, deck.created_at],
        )?;
        let id = tx.last_insert_rowid();
        insert_items(&tx, id, &deck.items)?;
        ids.insert(deck.r#ref.clone(), id);
    }

    {
        let mut find = tx.prepare("SELECT id FROM items WHERE deck_id = ?1 AND term = ?2")?;
        let mut insert = tx.prepare(
            "INSERT OR REPLACE INTO reviews
               (item_id, ease, interval_days, reps, due_at, last_result, lapses, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        )?;
        for r in &file.reviews {
            let Some(&deck_id) = ids.get(&r.deck_ref) else {
                continue;
            };
            let item_id: Option<i64> = find
                .query_row(params![deck_id, r.term], |row| row.get(0))
                .optional()?;
            if let Some(item_id) = item_id {
                insert.execute(params![
                    item_id,
                    r.ease,
                    r.interval_days,
                    r.reps,
                    r.due_at,
                    r.last_result,
                    r.lapses,
                    r.created_at
                ])?;
            }
        }
    }

    settings::save(&tx, &file.settings)?;
    tx.commit()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::{
        decks::create_with_items,
        migrations::migrate,
        seed::{BuiltinDeck, seed_builtin},
    };

    const BUILTIN: &[BuiltinDeck] = &[BuiltinDeck {
        key: "b",
        version: 1,
        json: r#"{"name":"内置","items":[{"term":"deploy","meaning":"部署"},{"term":"merge","meaning":"合并"}]}"#,
    }];

    fn setup() -> Connection {
        let mut c = Connection::open_in_memory().unwrap();
        c.pragma_update(None, "foreign_keys", "ON").unwrap();
        migrate(&mut c).unwrap();
        seed_builtin(&mut c, BUILTIN, 0).unwrap();
        c
    }

    fn review(c: &Connection, term: &str, due: i64) {
        let id: i64 = c
            .query_row("SELECT id FROM items WHERE term = ?1", [term], |r| r.get(0))
            .unwrap();
        c.execute(
            "INSERT INTO reviews (item_id, reps, due_at, created_at) VALUES (?1, 2, ?2, 9)",
            params![id, due],
        )
        .unwrap();
    }

    fn count(c: &Connection, sql: &str) -> i64 {
        c.query_row(sql, [], |r| r.get(0)).unwrap()
    }

    fn sample_source() -> Connection {
        let mut c = setup();
        let items = [NewItem {
            term: "rebase".into(),
            meaning: "变基".into(),
            example: Some("Rebase first.".into()),
            phonetic: None,
            pos: None,
        }];
        create_with_items(&mut c, "我的生词本", "user", &items, 3).unwrap();
        review(&c, "deploy", 100);
        review(&c, "rebase", 200);
        let s = Settings {
            skin: "paper".into(),
            ..Default::default()
        };
        settings::save(&c, &s).unwrap();
        c
    }

    #[test]
    fn export_contains_custom_items_but_not_builtin_items() {
        let file = export(&sample_source(), 1).unwrap();
        assert_eq!(file.format, FORMAT);
        let builtin = file.decks.iter().find(|d| d.r#ref == "builtin:b").unwrap();
        assert!(builtin.items.is_empty());
        let custom = file.decks.iter().find(|d| d.source == "user").unwrap();
        assert_eq!(custom.items.len(), 1);
        assert_eq!(file.reviews.len(), 2);
        assert_eq!(file.settings.skin, "paper");
    }

    #[test]
    fn round_trip_into_a_fresh_install() {
        let file = export(&sample_source(), 1).unwrap();
        let json = serde_json::to_string(&file).unwrap();
        let mut target = setup();
        review(&target, "merge", 5); // existing progress must be replaced
        import(&mut target, &parse(&json).unwrap()).unwrap();

        assert_eq!(count(&target, "SELECT COUNT(*) FROM decks"), 2);
        assert_eq!(count(&target, "SELECT COUNT(*) FROM reviews"), 2);
        assert_eq!(
            count(
                &target,
                "SELECT due_at FROM reviews r JOIN items i ON i.id = r.item_id WHERE i.term = 'rebase'"
            ),
            200
        );
        assert_eq!(
            count(
                &target,
                "SELECT COUNT(*) FROM reviews r JOIN items i ON i.id = r.item_id WHERE i.term = 'merge'"
            ),
            0
        );
        assert_eq!(settings::load(&target).unwrap().skin, "paper");
    }

    #[test]
    fn import_twice_does_not_duplicate_custom_decks() {
        let file = export(&sample_source(), 1).unwrap();
        let mut target = setup();
        import(&mut target, &file).unwrap();
        import(&mut target, &file).unwrap();
        assert_eq!(
            count(&target, "SELECT COUNT(*) FROM decks WHERE source = 'user'"),
            1
        );
    }

    #[test]
    fn rejects_other_json() {
        assert!(matches!(parse("{}"), Err(ImportError::BadFormat(_))));
        let wrong =
            r#"{"format":"x","version":1,"exportedAt":0,"settings":{},"decks":[],"reviews":[]}"#;
        assert!(matches!(parse(wrong), Err(ImportError::BadFormat(_))));
    }
}
