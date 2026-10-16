//! Local storage in SQLite: everything stays in the app's data folder on this
//! computer (`%APPDATA%\app.wisp.focus\wisp.sqlite3`).

mod migrations;
mod queries;

use std::path::Path;

use rusqlite::Connection;

pub use queries::FocusSession;

/// `Box<dyn Error>` means "any kind of error": opening can fail in the file
/// system, in SQLite or in a migration, and the caller only logs it.
pub type OpenError = Box<dyn std::error::Error + Send + Sync>;

pub struct Db {
    conn: Connection,
}

impl Db {
    /// Opens (or creates) the database file and brings its tables up to date.
    pub fn open(path: &Path) -> Result<Db, OpenError> {
        if let Some(folder) = path.parent() {
            std::fs::create_dir_all(folder)?;
        }
        let mut conn = Connection::open(path)?;
        migrations::MIGRATIONS.to_latest(&mut conn)?;
        Ok(Db { conn })
    }

    /// A throw-away database for tests.
    #[cfg(test)]
    pub fn in_memory() -> Db {
        let mut conn = Connection::open_in_memory().expect("in-memory database");
        migrations::MIGRATIONS
            .to_latest(&mut conn)
            .expect("migrations apply");
        Db { conn }
    }
}
