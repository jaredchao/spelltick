//! Queries used to pick the next question and to record an answer.
//! Selection rules themselves live in `src/core/select.ts`.

use rusqlite::{Connection, OptionalExtension, Result, Row, params};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ReviewRecord {
    pub ease: f64,
    pub interval_days: f64,
    pub reps: i64,
    pub due_at: i64,
    pub last_result: Option<String>,
    pub lapses: i64,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct QuizItem {
    pub id: i64,
    pub deck_id: i64,
    pub deck_name: String,
    pub kind: String,
    pub term: String,
    pub meaning: String,
    pub phonetic: Option<String>,
    pub pos: Option<String>,
    pub example: Option<String>,
    pub review: Option<ReviewRecord>,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Candidates {
    pub due: Option<QuizItem>,
    pub new_words: Vec<QuizItem>,
    pub new_sentences: Vec<QuizItem>,
    pub new_today: i64,
    pub recent_wrong_words: Vec<QuizItem>,
    pub recent_wrong_sentences: Vec<QuizItem>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CandidateQuery {
    pub now: i64,
    pub day_start: i64,
    pub recent_since: i64,
    pub exclude_item_id: Option<i64>,
    pub sample_size: i64,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AttemptInput {
    pub item_id: i64,
    pub quiz_type: String,
    pub answer: String,
    pub correct: bool,
    pub used_hint: bool,
    pub at: i64,
    pub review: ReviewRecord,
}

const ITEM_COLUMNS: &str =
    "i.id, i.deck_id, d.name, i.kind, i.term, i.meaning, i.phonetic, i.pos, i.example,
     r.ease, r.interval_days, r.reps, r.due_at, r.last_result, r.lapses";

const ITEM_FROM: &str = "FROM items i
     JOIN decks d ON d.id = i.deck_id AND d.enabled = 1
     LEFT JOIN reviews r ON r.item_id = i.id";

fn map_item(row: &Row) -> Result<QuizItem> {
    let due_at: Option<i64> = row.get(12)?;
    let review = match due_at {
        Some(due_at) => Some(ReviewRecord {
            ease: row.get(9)?,
            interval_days: row.get(10)?,
            reps: row.get(11)?,
            due_at,
            last_result: row.get(13)?,
            lapses: row.get(14)?,
        }),
        None => None,
    };
    Ok(QuizItem {
        id: row.get(0)?,
        deck_id: row.get(1)?,
        deck_name: row.get(2)?,
        kind: row.get(3)?,
        term: row.get(4)?,
        meaning: row.get(5)?,
        phonetic: row.get(6)?,
        pos: row.get(7)?,
        example: row.get(8)?,
        review,
    })
}

fn exclude(q: &CandidateQuery) -> i64 {
    q.exclude_item_id.unwrap_or(-1)
}

fn due(conn: &Connection, q: &CandidateQuery) -> Result<Option<QuizItem>> {
    let sql = format!(
        "SELECT {ITEM_COLUMNS} {ITEM_FROM}
         WHERE r.due_at <= ?1 AND i.id != ?2
         ORDER BY r.due_at ASC LIMIT 1"
    );
    conn.query_row(&sql, params![q.now, exclude(q)], map_item)
        .optional()
}

fn new_items(conn: &Connection, q: &CandidateQuery, kind: &str) -> Result<Vec<QuizItem>> {
    let sql = format!(
        "SELECT {ITEM_COLUMNS} {ITEM_FROM}
         WHERE r.item_id IS NULL AND i.kind = ?1 AND i.id != ?2
         ORDER BY RANDOM() LIMIT ?3"
    );
    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt.query_map(params![kind, exclude(q), q.sample_size], map_item)?;
    rows.collect()
}

fn recent_wrong(conn: &Connection, q: &CandidateQuery, kind: &str) -> Result<Vec<QuizItem>> {
    let sql = format!(
        "SELECT {ITEM_COLUMNS} {ITEM_FROM}
         WHERE i.kind = ?1 AND i.id != ?2
           AND i.id IN (SELECT item_id FROM attempts WHERE correct = 0 AND at >= ?3)
         ORDER BY RANDOM() LIMIT ?4"
    );
    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt.query_map(
        params![kind, exclude(q), q.recent_since, q.sample_size],
        map_item,
    )?;
    rows.collect()
}

fn new_today(conn: &Connection, day_start: i64) -> Result<i64> {
    conn.query_row(
        "SELECT COUNT(*) FROM reviews WHERE created_at >= ?1",
        [day_start],
        |r| r.get(0),
    )
}

pub fn candidates(conn: &Connection, q: &CandidateQuery) -> Result<Candidates> {
    Ok(Candidates {
        due: due(conn, q)?,
        new_words: new_items(conn, q, "word")?,
        new_sentences: new_items(conn, q, "sentence")?,
        new_today: new_today(conn, q.day_start)?,
        recent_wrong_words: recent_wrong(conn, q, "word")?,
        recent_wrong_sentences: recent_wrong(conn, q, "sentence")?,
    })
}

/// Write one attempt and the updated review in a single transaction.
/// `created_at` is set only when the review row is first inserted.
pub fn record_attempt(conn: &mut Connection, input: &AttemptInput) -> Result<()> {
    let tx = conn.transaction()?;
    tx.execute(
        "INSERT INTO attempts (item_id, quiz_type, answer, correct, used_hint, at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![
            input.item_id,
            input.quiz_type,
            input.answer,
            input.correct,
            input.used_hint,
            input.at
        ],
    )?;
    let r = &input.review;
    tx.execute(
        "INSERT INTO reviews (item_id, ease, interval_days, reps, due_at, last_result, lapses, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
         ON CONFLICT(item_id) DO UPDATE SET
           ease = excluded.ease, interval_days = excluded.interval_days, reps = excluded.reps,
           due_at = excluded.due_at, last_result = excluded.last_result, lapses = excluded.lapses",
        params![
            input.item_id,
            r.ease,
            r.interval_days,
            r.reps,
            r.due_at,
            r.last_result,
            r.lapses,
            input.at
        ],
    )?;
    tx.commit()
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct TodayStats {
    pub total: i64,
    pub correct: i64,
}

pub fn today_stats(conn: &Connection, day_start: i64) -> Result<TodayStats> {
    conn.query_row(
        "SELECT COUNT(*), COALESCE(SUM(correct), 0) FROM attempts WHERE at >= ?1",
        [day_start],
        |r| {
            Ok(TodayStats {
                total: r.get(0)?,
                correct: r.get(1)?,
            })
        },
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::{
        migrations::migrate,
        seed::{BuiltinDeck, seed_builtin},
    };

    const MIN: i64 = 60_000;
    const DECK: &str = r#"{"name":"测试","items":[
        {"term":"deploy","meaning":"部署"},
        {"term":"merge","meaning":"合并"},
        {"term":"Ship it.","meaning":"发布吧。"}
    ]}"#;

    fn setup() -> Connection {
        let mut c = Connection::open_in_memory().unwrap();
        migrate(&mut c).unwrap();
        seed_builtin(
            &mut c,
            &[BuiltinDeck {
                key: "t",
                version: 1,
                json: DECK,
            }],
            0,
        )
        .unwrap();
        c
    }

    fn id_of(c: &Connection, term: &str) -> i64 {
        c.query_row("SELECT id FROM items WHERE term = ?1", [term], |r| r.get(0))
            .unwrap()
    }

    fn query(now: i64) -> CandidateQuery {
        CandidateQuery {
            now,
            day_start: 0,
            recent_since: 0,
            exclude_item_id: None,
            sample_size: 10,
        }
    }

    fn answer(c: &mut Connection, item_id: i64, correct: bool, at: i64, due_at: i64) {
        record_attempt(
            c,
            &AttemptInput {
                item_id,
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
                    lapses: if correct { 0 } else { 1 },
                },
            },
        )
        .unwrap();
    }

    #[test]
    fn fresh_deck_has_only_new_items() {
        let c = setup();
        let cands = candidates(&c, &query(0)).unwrap();
        assert!(cands.due.is_none());
        assert_eq!(cands.new_words.len(), 2);
        assert_eq!(cands.new_sentences.len(), 1);
        assert_eq!(cands.new_today, 0);
    }

    #[test]
    fn wrong_answer_becomes_due_after_ten_minutes() {
        let mut c = setup();
        let id = id_of(&c, "deploy");
        answer(&mut c, id, false, 0, 10 * MIN);

        let before = candidates(&c, &query(9 * MIN)).unwrap();
        assert!(before.due.is_none());
        assert!(before.new_words.iter().all(|i| i.id != id));
        assert_eq!(before.recent_wrong_words.len(), 1);

        let after = candidates(&c, &query(10 * MIN)).unwrap();
        let due = after.due.expect("deploy should be due");
        assert_eq!(due.id, id);
        assert_eq!(due.review.unwrap().lapses, 1);
    }

    #[test]
    fn due_orders_by_earliest() {
        let mut c = setup();
        {
            let id = id_of(&c, "deploy");
            answer(&mut c, id, false, 0, 20 * MIN);
        }
        {
            let id = id_of(&c, "merge");
            answer(&mut c, id, false, 0, 10 * MIN);
        }
        let due = candidates(&c, &query(30 * MIN)).unwrap().due.unwrap();
        assert_eq!(due.term, "merge");
    }

    #[test]
    fn excludes_given_item() {
        let mut c = setup();
        let id = id_of(&c, "deploy");
        answer(&mut c, id, false, 0, 0);
        let q = CandidateQuery {
            exclude_item_id: Some(id),
            ..query(MIN)
        };
        let cands = candidates(&c, &q).unwrap();
        assert!(cands.due.is_none());
        assert!(cands.recent_wrong_words.is_empty());
    }

    #[test]
    fn counts_new_today_from_first_answer_only() {
        let mut c = setup();
        let id = id_of(&c, "deploy");
        answer(&mut c, id, false, 100, 200);
        answer(&mut c, id, true, 300, 400);
        let cands = candidates(
            &c,
            &CandidateQuery {
                day_start: 50,
                ..query(500)
            },
        )
        .unwrap();
        assert_eq!(cands.new_today, 1);
        let created: i64 = c
            .query_row(
                "SELECT created_at FROM reviews WHERE item_id = ?1",
                [id],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(created, 100);
    }

    #[test]
    fn disabled_decks_are_ignored() {
        let c = setup();
        c.execute("UPDATE decks SET enabled = 0", []).unwrap();
        let cands = candidates(&c, &query(0)).unwrap();
        assert!(cands.new_words.is_empty() && cands.new_sentences.is_empty());
    }

    #[test]
    fn today_stats_counts_attempts() {
        let mut c = setup();
        {
            let id = id_of(&c, "deploy");
            answer(&mut c, id, false, 100, 200);
        }
        {
            let id = id_of(&c, "merge");
            answer(&mut c, id, true, 150, 200);
        }
        {
            let id = id_of(&c, "merge");
            answer(&mut c, id, true, 10, 200);
        }
        assert_eq!(
            today_stats(&c, 50).unwrap(),
            TodayStats {
                total: 2,
                correct: 1
            }
        );
    }
}
