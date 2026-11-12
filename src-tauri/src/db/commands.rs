//! Tauri commands exposing the quiz queries to the frontend.

use tauri::State;

use super::{
    Db,
    quiz::{self, AttemptInput, CandidateQuery, Candidates, QuizItem, TodayStats},
};

fn lock<'a>(
    db: &'a State<'_, Db>,
) -> Result<std::sync::MutexGuard<'a, rusqlite::Connection>, String> {
    db.0.lock()
        .map_err(|_| "database lock poisoned".to_string())
}

#[tauri::command]
pub fn quiz_candidates(db: State<'_, Db>, query: CandidateQuery) -> Result<Candidates, String> {
    let conn = lock(&db)?;
    quiz::candidates(&conn, &query).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn quiz_record_attempt(db: State<'_, Db>, input: AttemptInput) -> Result<(), String> {
    let mut conn = lock(&db)?;
    quiz::record_attempt(&mut conn, &input).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn quiz_today_stats(db: State<'_, Db>, day_start: i64) -> Result<TodayStats, String> {
    let conn = lock(&db)?;
    quiz::today_stats(&conn, day_start).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn quiz_item(db: State<'_, Db>, id: i64) -> Result<Option<QuizItem>, String> {
    let conn = lock(&db)?;
    quiz::item_by_id(&conn, id).map_err(|e| e.to_string())
}
