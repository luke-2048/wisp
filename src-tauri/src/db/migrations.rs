//! Database schema, one step per version. Never edit a step that has shipped:
//! add a new one at the end, and `rusqlite_migration` applies only what is
//! missing on the user's computer.

use rusqlite_migration::{M, Migrations};

const STEPS: &[M<'static>] = &[
    // v1: the four tables of v0.1. Times are milliseconds since 1970.
    M::up(
        "CREATE TABLE settings (
            key   TEXT PRIMARY KEY,
            value TEXT NOT NULL -- JSON
        );
        CREATE TABLE tasks (
            id         INTEGER PRIMARY KEY,
            title      TEXT    NOT NULL,
            created_at INTEGER NOT NULL,
            done_at    INTEGER          -- NULL while it is the current task
        );
        CREATE TABLE focus_sessions (
            id         INTEGER PRIMARY KEY,
            started_at INTEGER NOT NULL,
            ended_at   INTEGER NOT NULL,
            planned_ms INTEGER NOT NULL,
            completed  INTEGER NOT NULL  -- 1 if the timer reached zero
        );
        CREATE TABLE parked_ideas (
            id         INTEGER PRIMARY KEY,
            text       TEXT    NOT NULL,
            created_at INTEGER NOT NULL,
            seen       INTEGER NOT NULL DEFAULT 0
        );",
    ),
];

pub const MIGRATIONS: Migrations<'static> = Migrations::from_slice(STEPS);

#[cfg(test)]
mod tests {
    #[test]
    fn migrations_are_valid() {
        assert!(super::MIGRATIONS.validate().is_ok());
    }
}
