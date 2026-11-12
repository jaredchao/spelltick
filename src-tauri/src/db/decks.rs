//! Deck management for the settings page: list, enable, delete, import.

use rusqlite::{Connection, Result, params};
use serde::{Deserialize, Serialize};

use super::seed::kind_of;

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct DeckSummary {
    pub id: i64,
    pub name: String,
    pub source: String,
    pub enabled: bool,
    pub learned: i64,
    pub total: i64,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct NewItem {
    pub term: String,
    pub meaning: String,
    #[serde(default)]
    pub example: Option<String>,
    #[serde(default)]
    pub phonetic: Option<String>,
    #[serde(default)]
    pub pos: Option<String>,
}

pub fn list(conn: &Connection) -> Result<Vec<DeckSummary>> {
    let mut stmt = conn.prepare(
        "SELECT d.id, d.name, d.source, d.enabled,
                COUNT(r.item_id), COUNT(i.id)
         FROM decks d
         LEFT JOIN items i ON i.deck_id = d.id
         LEFT JOIN reviews r ON r.item_id = i.id
         GROUP BY d.id
         ORDER BY CASE d.source WHEN 'builtin' THEN 0 ELSE 1 END, d.id",
    )?;
    let rows = stmt.query_map([], |r| {
        Ok(DeckSummary {
            id: r.get(0)?,
            name: r.get(1)?,
            source: r.get(2)?,
            enabled: r.get(3)?,
            learned: r.get(4)?,
            total: r.get(5)?,
        })
    })?;
    rows.collect()
}

pub fn set_enabled(conn: &Connection, id: i64, enabled: bool) -> Result<()> {
    conn.execute(
        "UPDATE decks SET enabled = ?1 WHERE id = ?2",
        params![enabled, id],
    )?;
    Ok(())
}

/// Delete a non-built-in deck (items, reviews and attempts cascade).
/// Returns false when the deck is built-in or missing.
pub fn delete(conn: &Connection, id: i64) -> Result<bool> {
    let changed = conn.execute(
        "DELETE FROM decks WHERE id = ?1 AND source != 'builtin'",
        [id],
    )?;
    Ok(changed > 0)
}

/// Insert items into a deck; duplicate terms in the same deck are skipped.
/// Returns how many rows were inserted.
pub fn insert_items(conn: &Connection, deck_id: i64, items: &[NewItem]) -> Result<usize> {
    let mut stmt = conn.prepare(
        "INSERT INTO items (deck_id, kind, term, meaning, phonetic, pos, example)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
         ON CONFLICT(deck_id, term) DO NOTHING",
    )?;
    let mut inserted = 0;
    for item in items {
        let term = item.term.trim();
        inserted += stmt.execute(params![
            deck_id,
            kind_of(term),
            term,
            item.meaning.trim(),
            item.phonetic,
            item.pos,
            item.example
                .as_deref()
                .map(str::trim)
                .filter(|s| !s.is_empty()),
        ])?;
    }
    Ok(inserted)
}

/// Create a new deck with the given source and items in one transaction.
pub fn create_with_items(
    conn: &mut Connection,
    name: &str,
    source: &str,
    items: &[NewItem],
    now: i64,
) -> Result<(i64, usize)> {
    let tx = conn.transaction()?;
    tx.execute(
        "INSERT INTO decks (name, source, enabled, created_at) VALUES (?1, ?2, 1, ?3)",
        params![name.trim(), source, now],
    )?;
    let deck_id = tx.last_insert_rowid();
    let inserted = insert_items(&tx, deck_id, items)?;
    tx.commit()?;
    Ok((deck_id, inserted))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::{
        migrations::migrate,
        seed::{BuiltinDeck, seed_builtin},
    };

    fn setup() -> Connection {
        let mut c = Connection::open_in_memory().unwrap();
        c.pragma_update(None, "foreign_keys", "ON").unwrap();
        migrate(&mut c).unwrap();
        seed_builtin(
            &mut c,
            &[BuiltinDeck {
                key: "b",
                version: 1,
                json: r#"{"name":"内置","items":[{"term":"deploy","meaning":"部署"}]}"#,
            }],
            0,
        )
        .unwrap();
        c
    }

    fn item(term: &str) -> NewItem {
        NewItem {
            term: term.into(),
            meaning: "义".into(),
            example: None,
            phonetic: None,
            pos: None,
        }
    }

    #[test]
    fn imports_new_deck_and_skips_duplicates() {
        let mut c = setup();
        let items = [item("merge"), item("Ship it."), item("merge")];
        let (id, inserted) = create_with_items(&mut c, " 我的词 ", "imported", &items, 5).unwrap();
        assert_eq!(inserted, 2);
        let decks = list(&c).unwrap();
        let deck = decks.iter().find(|d| d.id == id).unwrap();
        assert_eq!(deck.name, "我的词");
        assert_eq!(deck.source, "imported");
        assert_eq!(deck.total, 2);
        assert_eq!(deck.learned, 0);
    }

    #[test]
    fn builtin_decks_cannot_be_deleted() {
        let mut c = setup();
        let builtin = list(&c).unwrap()[0].id;
        assert!(!delete(&c, builtin).unwrap());
        let (id, _) = create_with_items(&mut c, "x", "imported", &[item("a")], 0).unwrap();
        assert!(delete(&c, id).unwrap());
        assert_eq!(list(&c).unwrap().len(), 1);
    }

    #[test]
    fn toggles_enabled() {
        let c = setup();
        let id = list(&c).unwrap()[0].id;
        set_enabled(&c, id, false).unwrap();
        assert!(!list(&c).unwrap()[0].enabled);
    }

    #[test]
    fn counts_learned_items() {
        let c = setup();
        let item_id: i64 = c
            .query_row("SELECT id FROM items", [], |r| r.get(0))
            .unwrap();
        c.execute(
            "INSERT INTO reviews (item_id, due_at) VALUES (?1, 0)",
            [item_id],
        )
        .unwrap();
        assert_eq!(list(&c).unwrap()[0].learned, 1);
    }

    #[test]
    fn blank_example_is_stored_as_null() {
        let mut c = setup();
        let items = [NewItem {
            example: Some("  ".into()),
            ..item("rebase")
        }];
        create_with_items(&mut c, "x", "imported", &items, 0).unwrap();
        let ex: Option<String> = c
            .query_row("SELECT example FROM items WHERE term = 'rebase'", [], |r| {
                r.get(0)
            })
            .unwrap();
        assert_eq!(ex, None);
    }
}
