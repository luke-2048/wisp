//! What Wisp reads and writes. Each function is one small, plain SQL query.

use rusqlite::{OptionalExtension, Result, params};
use wisp_core::{ideas::ParkedIdea, models::Settings};

use super::Db;

// SQLite stores whole numbers as signed 64-bit (`i64`); idea ids are `u64`.
// Ids are small counters, so the conversion never loses anything.
fn to_sql_id(id: u64) -> i64 {
    i64::try_from(id).unwrap_or(i64::MAX)
}

/// One timer run, saved when it ends.
pub struct FocusSession {
    pub started_ms: i64,
    pub ended_ms: i64,
    pub planned_ms: i64,
    pub completed: bool,
}

impl Db {
    // ---- Settings: one row per field, the value as JSON ----

    pub fn load_settings(&self) -> Result<Settings> {
        let mut statement = self.conn.prepare("SELECT key, value FROM settings")?;
        let rows = statement.query_map([], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
        })?;
        let mut fields = serde_json::Map::new();
        for row in rows {
            let (key, value) = row?;
            if let Ok(value) = serde_json::from_str(&value) {
                fields.insert(key, value);
            }
        }
        // Missing or unreadable fields get their default (`serde(default)`).
        let settings: Settings =
            serde_json::from_value(serde_json::Value::Object(fields)).unwrap_or_default();
        Ok(settings.sanitized())
    }

    pub fn save_settings(&mut self, settings: &Settings) -> Result<()> {
        let Ok(serde_json::Value::Object(fields)) = serde_json::to_value(settings) else {
            return Ok(());
        };
        // A transaction writes all fields or none of them.
        let transaction = self.conn.transaction()?;
        for (key, value) in fields {
            transaction.execute(
                "INSERT INTO settings (key, value) VALUES (?1, ?2)
                 ON CONFLICT(key) DO UPDATE SET value = excluded.value",
                params![key, value.to_string()],
            )?;
        }
        transaction.commit()
    }

    // ---- Tasks: the current one has no `done_at` ----

    pub fn current_task(&self) -> Result<Option<String>> {
        self.conn
            .query_row(
                "SELECT title FROM tasks WHERE done_at IS NULL ORDER BY id DESC LIMIT 1",
                [],
                |row| row.get(0),
            )
            .optional()
    }

    /// Sets, renames or clears (`None`) the current task.
    pub fn set_current_task(&self, title: Option<&str>, now_ms: i64) -> Result<()> {
        match title {
            Some(title) => {
                let renamed = self.conn.execute(
                    "UPDATE tasks SET title = ?1 WHERE done_at IS NULL",
                    params![title],
                )?;
                if renamed == 0 {
                    self.conn.execute(
                        "INSERT INTO tasks (title, created_at) VALUES (?1, ?2)",
                        params![title, now_ms],
                    )?;
                }
            }
            None => {
                self.conn
                    .execute("DELETE FROM tasks WHERE done_at IS NULL", [])?;
            }
        }
        Ok(())
    }

    /// "Fatto": the current task joins the history.
    pub fn complete_current_task(&self, now_ms: i64) -> Result<()> {
        self.conn.execute(
            "UPDATE tasks SET done_at = ?1 WHERE done_at IS NULL",
            params![now_ms],
        )?;
        Ok(())
    }

    // ---- Focus sessions ----

    pub fn save_session(&self, session: &FocusSession) -> Result<()> {
        self.conn.execute(
            "INSERT INTO focus_sessions (started_at, ended_at, planned_ms, completed)
             VALUES (?1, ?2, ?3, ?4)",
            params![
                session.started_ms,
                session.ended_ms,
                session.planned_ms,
                session.completed
            ],
        )?;
        Ok(())
    }

    // ---- Parked ideas ----

    /// Oldest first.
    pub fn load_ideas(&self) -> Result<Vec<ParkedIdea>> {
        let mut statement = self
            .conn
            .prepare("SELECT id, text, created_at, seen FROM parked_ideas ORDER BY id")?;
        let ideas = statement.query_map([], |row| {
            Ok(ParkedIdea {
                id: u64::try_from(row.get::<_, i64>(0)?).unwrap_or_default(),
                text: row.get(1)?,
                created_ms: row.get(2)?,
                seen: row.get(3)?,
            })
        })?;
        // `collect` turns many `Result<idea>` into one `Result<Vec<idea>>`.
        ideas.collect()
    }

    pub fn insert_idea(&self, idea: &ParkedIdea) -> Result<()> {
        self.conn.execute(
            "INSERT INTO parked_ideas (id, text, created_at, seen) VALUES (?1, ?2, ?3, ?4)",
            params![to_sql_id(idea.id), idea.text, idea.created_ms, idea.seen],
        )?;
        Ok(())
    }

    pub fn mark_idea_seen(&self, id: u64) -> Result<()> {
        self.conn.execute(
            "UPDATE parked_ideas SET seen = 1 WHERE id = ?1",
            params![to_sql_id(id)],
        )?;
        Ok(())
    }

    pub fn delete_idea(&self, id: u64) -> Result<()> {
        self.conn.execute(
            "DELETE FROM parked_ideas WHERE id = ?1",
            params![to_sql_id(id)],
        )?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use wisp_core::models::PaletteName;

    use super::*;

    fn count(db: &Db, sql: &str) -> i64 {
        db.conn.query_row(sql, [], |row| row.get(0)).unwrap()
    }

    #[test]
    fn settings_round_trip_and_default_when_empty() {
        let mut db = Db::in_memory();
        assert_eq!(db.load_settings().unwrap(), Settings::default());
        let changed = Settings {
            palette: PaletteName::Pesca,
            break_after_minutes: 60,
            ..Settings::default()
        };
        db.save_settings(&changed).unwrap();
        db.save_settings(&changed).unwrap(); // saving twice just overwrites
        assert_eq!(db.load_settings().unwrap(), changed);
    }

    #[test]
    fn current_task_is_set_renamed_completed_and_cleared() {
        let db = Db::in_memory();
        assert_eq!(db.current_task().unwrap(), None);
        db.set_current_task(Some("write report"), 1).unwrap();
        db.set_current_task(Some("write the report"), 2).unwrap();
        assert_eq!(
            db.current_task().unwrap().as_deref(),
            Some("write the report")
        );
        db.complete_current_task(3).unwrap();
        assert_eq!(db.current_task().unwrap(), None);
        db.set_current_task(Some("next"), 4).unwrap();
        db.set_current_task(None, 5).unwrap();
        assert_eq!(db.current_task().unwrap(), None);
        assert_eq!(
            count(&db, "SELECT COUNT(*) FROM tasks WHERE done_at IS NOT NULL"),
            1
        );
    }

    #[test]
    fn ideas_are_saved_marked_and_deleted() {
        let db = Db::in_memory();
        let idea = |id, text: &str| ParkedIdea {
            id,
            text: text.into(),
            created_ms: 10,
            seen: false,
        };
        db.insert_idea(&idea(1, "a")).unwrap();
        db.insert_idea(&idea(2, "b")).unwrap();
        db.mark_idea_seen(1).unwrap();
        db.delete_idea(2).unwrap();
        let ideas = db.load_ideas().unwrap();
        assert_eq!(ideas.len(), 1);
        assert_eq!(ideas[0].text, "a");
        assert!(ideas[0].seen);
    }

    #[test]
    fn sessions_are_saved() {
        let db = Db::in_memory();
        db.save_session(&FocusSession {
            started_ms: 0,
            ended_ms: 900_000,
            planned_ms: 900_000,
            completed: true,
        })
        .unwrap();
        assert_eq!(count(&db, "SELECT COUNT(*) FROM focus_sessions"), 1);
    }
}
