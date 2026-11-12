//! Read-only learning history: every item the user has answered at least once.

use rusqlite::{Connection, Result, params};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum HistoryFilter {
    All,
    /// Answered wrong (or skipped) at least once.
    Wrong,
    /// Review is due now.
    Due,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HistoryQuery {
    pub filter: HistoryFilter,
    pub search: String,
    pub now: i64,
    pub limit: i64,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct HistoryRow {
    pub item_id: i64,
    pub term: String,
    pub meaning: String,
    pub kind: String,
    pub deck_name: String,
    pub attempts: i64,
    pub correct: i64,
    pub last_at: i64,
    pub last_result: Option<String>,
    pub due_at: Option<i64>,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct HistoryCounts {
    pub all: i64,
    pub wrong: i64,
    pub due: i64,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct HistoryPage {
    pub rows: Vec<HistoryRow>,
    pub counts: HistoryCounts,
}

/// Per-item aggregate over attempts, joined with item, deck and review.
const BASE: &str = "
    WITH stats AS (
      SELECT item_id, COUNT(*) AS attempts, SUM(correct) AS correct,
             MAX(at) AS last_at, SUM(CASE WHEN correct = 0 THEN 1 ELSE 0 END) AS wrong
      FROM attempts GROUP BY item_id
    )
    SELECT i.id, i.term, i.meaning, i.kind, d.name, s.attempts, s.correct, s.last_at,
           r.last_result, r.due_at, s.wrong
    FROM stats s
    JOIN items i ON i.id = s.item_id
    JOIN decks d ON d.id = i.deck_id
    LEFT JOIN reviews r ON r.item_id = i.id";

fn escape_like(s: &str) -> String {
    s.replace('\\', "\\\\")
        .replace('%', "\\%")
        .replace('_', "\\_")
}

pub fn list(conn: &Connection, q: &HistoryQuery) -> Result<HistoryPage> {
    let pattern = format!("%{}%", escape_like(q.search.trim()));
    let filter_sql = match q.filter {
        HistoryFilter::All => "1 = 1",
        HistoryFilter::Wrong => "s.wrong > 0",
        HistoryFilter::Due => "r.due_at IS NOT NULL AND r.due_at <= ?2",
    };
    let sql = format!(
        "{BASE}
         WHERE (i.term LIKE ?1 ESCAPE '\\' OR i.meaning LIKE ?1 ESCAPE '\\')
           AND {filter_sql} AND ?2 = ?2
         ORDER BY s.last_at DESC
         LIMIT ?3"
    );
    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt
        .query_map(params![pattern, q.now, q.limit], |r| {
            Ok(HistoryRow {
                item_id: r.get(0)?,
                term: r.get(1)?,
                meaning: r.get(2)?,
                kind: r.get(3)?,
                deck_name: r.get(4)?,
                attempts: r.get(5)?,
                correct: r.get(6)?,
                last_at: r.get(7)?,
                last_result: r.get(8)?,
                due_at: r.get(9)?,
            })
        })?
        .collect::<Result<Vec<_>>>()?;

    let counts = conn.query_row(
        &format!(
            "SELECT COUNT(*),
                    COALESCE(SUM(CASE WHEN wrong > 0 THEN 1 ELSE 0 END), 0),
                    COALESCE(SUM(CASE WHEN due_at IS NOT NULL AND due_at <= ?1 THEN 1 ELSE 0 END), 0)
             FROM ({BASE}) AS t"
        ),
        [q.now],
        |r| {
            Ok(HistoryCounts {
                all: r.get(0)?,
                wrong: r.get(1)?,
                due: r.get(2)?,
            })
        },
    )?;
    Ok(HistoryPage { rows, counts })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::{
        migrations::migrate,
        quiz::{AttemptInput, ReviewRecord, record_attempt},
        seed::{BuiltinDeck, seed_builtin},
    };

    fn setup() -> Connection {
        let mut c = Connection::open_in_memory().unwrap();
        migrate(&mut c).unwrap();
        seed_builtin(
            &mut c,
            &[BuiltinDeck {
                key: "t",
                version: 1,
                json: r#"{"name":"测试","items":[
                    {"term":"deploy","meaning":"部署"},
                    {"term":"merge","meaning":"合并"},
                    {"term":"rebase_x","meaning":"变基"},
                    {"term":"unused","meaning":"没练过"}
                ]}"#,
            }],
            0,
        )
        .unwrap();
        c
    }

    fn answer(c: &mut Connection, term: &str, correct: bool, at: i64, due_at: i64) {
        let id: i64 = c
            .query_row("SELECT id FROM items WHERE term = ?1", [term], |r| r.get(0))
            .unwrap();
        record_attempt(
            c,
            &AttemptInput {
                item_id: id,
                quiz_type: "zh2en".into(),
                answer: "x".into(),
                correct,
                used_hint: false,
                at,
                review: ReviewRecord {
                    ease: 2.5,
                    interval_days: 0.0,
                    reps: 0,
                    due_at,
                    last_result: Some(if correct { "right" } else { "wrong" }.into()),
                    lapses: 0,
                },
            },
        )
        .unwrap();
    }

    fn query(filter: HistoryFilter, search: &str) -> HistoryQuery {
        HistoryQuery {
            filter,
            search: search.into(),
            now: 1_000,
            limit: 100,
        }
    }

    fn sample() -> Connection {
        let mut c = setup();
        answer(&mut c, "deploy", false, 10, 500); // wrong, due
        answer(&mut c, "deploy", true, 20, 5_000); // later right, not due
        answer(&mut c, "merge", true, 30, 900); // right, due
        answer(&mut c, "rebase_x", false, 5, 9_000); // wrong, not due
        c
    }

    #[test]
    fn lists_only_practiced_items_newest_first() {
        let page = list(&sample(), &query(HistoryFilter::All, "")).unwrap();
        let terms: Vec<_> = page.rows.iter().map(|r| r.term.as_str()).collect();
        assert_eq!(terms, ["merge", "deploy", "rebase_x"]);
        let deploy = &page.rows[1];
        assert_eq!(
            (deploy.attempts, deploy.correct, deploy.last_at),
            (2, 1, 20)
        );
        assert_eq!(deploy.last_result.as_deref(), Some("right"));
        assert_eq!(
            page.counts,
            HistoryCounts {
                all: 3,
                wrong: 2,
                due: 1
            }
        );
    }

    #[test]
    fn filters_wrong_and_due() {
        let c = sample();
        let wrong: Vec<_> = list(&c, &query(HistoryFilter::Wrong, ""))
            .unwrap()
            .rows
            .into_iter()
            .map(|r| r.term)
            .collect();
        assert_eq!(wrong, ["deploy", "rebase_x"]);
        let due: Vec<_> = list(&c, &query(HistoryFilter::Due, ""))
            .unwrap()
            .rows
            .into_iter()
            .map(|r| r.term)
            .collect();
        assert_eq!(due, ["merge"]);
    }

    #[test]
    fn searches_term_and_meaning_literally() {
        let c = sample();
        let by_meaning = list(&c, &query(HistoryFilter::All, "合并")).unwrap();
        assert_eq!(by_meaning.rows.len(), 1);
        // "_" must not act as a wildcard
        let underscore = list(&c, &query(HistoryFilter::All, "e_x")).unwrap();
        assert_eq!(underscore.rows.len(), 1);
        assert_eq!(underscore.rows[0].term, "rebase_x");
        // counts ignore the search box
        assert_eq!(by_meaning.counts.all, 3);
    }
}
