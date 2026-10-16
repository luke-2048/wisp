//! The app's live state: keeps the facts (task, timer, ideas, settings), asks
//! the core state machine which state Wisp is in, tells the frontend whenever
//! something changes, and saves every change to the local database.

use std::{
    sync::{Mutex, MutexGuard},
    thread,
    time::{Duration, Instant},
};

use chrono::Local;
use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager, State};
use wisp_core::{
    ideas::{Ideas, ParkedIdea},
    models::{Settings, WispState},
    state_machine::{self, DONE_DURATION, StateInput, StateRules},
    timer::{FocusTimer, TimerEvent, TimerStatus},
};

use crate::db::{Db, FocusSession};

/// Event carrying a fresh `Snapshot` to every window.
const STATE_EVENT: &str = "wisp://state";

/// The timer and the time-based rules are re-checked this often.
const TICK: Duration = Duration::from_secs(1);

/// Longest task title we keep; the field is one line.
const MAX_TASK_CHARS: usize = 200;

/// Shortest and longest timer the user can start, in minutes.
const TIMER_MINUTES: std::ops::RangeInclusive<u32> = 1..=240;

/// The database file, inside the app's data folder.
const DB_FILE: &str = "wisp.sqlite3";

/// Everything the frontend needs to draw.
#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct Snapshot {
    pub state: WispState,
    pub task: Option<String>,
    pub timer: TimerSnapshot,
    /// Newest first.
    pub ideas: Vec<ParkedIdea>,
    pub unseen_ideas: usize,
    pub settings: Settings,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct TimerSnapshot {
    pub status: TimerStatus,
    /// The frontend counts down from here on its own clock, between ticks.
    pub remaining_ms: u64,
    pub total_ms: u64,
}

/// The timer run in progress, saved as a focus session when it ends.
struct SessionStart {
    started_ms: i64,
    planned_ms: i64,
}

#[derive(Default)]
struct Inner {
    input: StateInput,
    rules: StateRules,
    settings: Settings,
    task: Option<String>,
    timer: FocusTimer,
    session: Option<SessionStart>,
    ideas: Ideas,
    /// `None` if the database could not be opened: Wisp still works, it just
    /// forgets everything when it quits.
    db: Option<Db>,
    /// The last snapshot sent, so we only emit real changes.
    sent: Option<Snapshot>,
}

impl Inner {
    /// Advances the timer and copies its facts into the state machine input.
    fn update(&mut self, now: Instant) {
        if self.timer.tick(now) == Some(TimerEvent::Finished) {
            self.input.waiting = true;
            self.end_session(true);
        }
        self.input.focus_streak = self.timer.focus_streak(now);
    }

    fn snapshot(&self, now: Instant) -> Snapshot {
        Snapshot {
            state: state_machine::evaluate(&self.input, &self.rules, now, Local::now().time()),
            task: self.task.clone(),
            timer: TimerSnapshot {
                status: self.timer.status(),
                remaining_ms: millis(self.timer.remaining(now)),
                total_ms: millis(self.timer.total()),
            },
            ideas: self.ideas.newest_first(),
            unseen_ideas: self.ideas.unseen_count(),
            settings: self.settings.clone(),
        }
    }

    /// Saves the timer run that just ended (if any) as a focus session.
    fn end_session(&mut self, completed: bool) {
        if let Some(start) = self.session.take() {
            let session = FocusSession {
                started_ms: start.started_ms,
                ended_ms: now_ms(),
                planned_ms: start.planned_ms,
                completed,
            };
            save(&mut self.db, "focus session", |db| {
                db.save_session(&session)
            });
        }
    }
}

/// Writes to the database if it is open; a failure is logged, never fatal.
fn save(db: &mut Option<Db>, what: &str, write: impl FnOnce(&mut Db) -> rusqlite::Result<()>) {
    if let Some(db) = db
        && let Err(error) = write(db)
    {
        eprintln!("could not save the {what}: {error}");
    }
}

fn millis(duration: Duration) -> u64 {
    u64::try_from(duration.as_millis()).unwrap_or(u64::MAX)
}

/// Wall-clock time for the database, in milliseconds since 1970.
fn now_ms() -> i64 {
    Local::now().timestamp_millis()
}

/// Shared by the tray, the windows and the frontend commands, behind a lock.
#[derive(Default)]
pub struct AppState(Mutex<Inner>);

impl AppState {
    fn lock(&self) -> MutexGuard<'_, Inner> {
        self.0
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
    }
}

/// Opens the database and brings back settings, current task and ideas.
/// Called once at startup, before anything reads the settings.
pub fn load(app: &AppHandle) {
    let db = app
        .path()
        .app_data_dir()
        .map_err(|error| error.to_string())
        .and_then(|folder| Db::open(&folder.join(DB_FILE)).map_err(|error| error.to_string()));
    let db = match db {
        Ok(db) => db,
        Err(error) => {
            eprintln!("could not open the database, nothing will be saved: {error}");
            return;
        }
    };
    change(app, |inner, _| {
        let settings = db.load_settings().unwrap_or_default();
        inner.rules = StateRules::from(&settings);
        inner.settings = settings;
        inner.task = db.current_task().unwrap_or_default();
        inner.ideas = Ideas::from_saved(db.load_ideas().unwrap_or_default());
        inner.db = Some(db);
    });
}

/// Starts the 1 s tick: timer end, end of "Fatto!", night.
pub fn start_ticking(app: AppHandle) {
    thread::spawn(move || {
        loop {
            thread::sleep(TICK);
            refresh(&app);
        }
    });
}

/// Applies a change to the facts, then re-evaluates and tells the frontend.
// `impl FnOnce(...)` accepts any closure (a small inline function) that we
// call exactly once; it gets the facts and the current time.
fn change(app: &AppHandle, apply: impl FnOnce(&mut Inner, Instant)) {
    {
        let state = app.state::<AppState>();
        let mut inner = state.lock();
        apply(&mut inner, Instant::now());
    }
    refresh(app);
}

pub fn settings(app: &AppHandle) -> Settings {
    app.state::<AppState>().lock().settings.clone()
}

/// New settings from the settings window, already checked by the caller.
pub fn apply_settings(app: &AppHandle, settings: Settings) {
    change(app, |inner, _| {
        save(&mut inner.db, "settings", |db| db.save_settings(&settings));
        inner.rules = StateRules::from(&settings);
        inner.settings = settings;
    });
}

/// Debug menu: `Some(state)` forces a state, `None` goes back to automatic.
// Only the debug menu calls it for now.
#[cfg_attr(not(debug_assertions), allow(dead_code))]
pub fn force(app: &AppHandle, state: Option<WispState>) {
    change(app, |inner, _| inner.input.forced = state);
}

/// The user opened or closed the island: whatever was waiting has been seen.
pub fn island_seen(app: &AppHandle) {
    change(app, |inner, _| inner.input.waiting = false);
}

pub fn set_task(app: &AppHandle, text: &str) {
    let title: String = text.trim().chars().take(MAX_TASK_CHARS).collect();
    let title = (!title.is_empty()).then_some(title);
    change(app, |inner, _| {
        save(&mut inner.db, "task", |db| {
            db.set_current_task(title.as_deref(), now_ms())
        });
        inner.task = title;
    });
}

/// "Fatto": Wisp celebrates, the task goes to the history, the field empties
/// and the timer stops, ready for the next task.
pub fn task_done(app: &AppHandle) {
    change(app, |inner, now| {
        if inner.task.take().is_some() {
            save(&mut inner.db, "finished task", |db| {
                db.complete_current_task(now_ms())
            });
            inner.input.done_until = Some(now + DONE_DURATION);
            inner.timer.stop(now);
            inner.end_session(false);
        }
    });
}

pub fn timer_start(app: &AppHandle, minutes: u32) {
    let minutes = minutes.clamp(*TIMER_MINUTES.start(), *TIMER_MINUTES.end());
    let duration = Duration::from_secs(u64::from(minutes) * 60);
    change(app, |inner, now| {
        inner.end_session(false); // a timer replaced before its end
        inner.timer.start(duration, now);
        inner.session = Some(SessionStart {
            started_ms: now_ms(),
            planned_ms: i64::try_from(duration.as_millis()).unwrap_or(i64::MAX),
        });
        inner.input.waiting = false;
    });
}

pub fn timer_pause(app: &AppHandle) {
    change(app, |inner, now| inner.timer.pause(now));
}

pub fn timer_resume(app: &AppHandle) {
    change(app, |inner, now| inner.timer.resume(now));
}

pub fn timer_stop(app: &AppHandle) {
    change(app, |inner, now| {
        inner.timer.stop(now);
        inner.end_session(false);
    });
}

pub fn park_idea(app: &AppHandle, text: &str) {
    change(app, |inner, _| {
        if let Some(idea) = inner.ideas.park(text, now_ms()) {
            save(&mut inner.db, "idea", |db| db.insert_idea(&idea));
        }
    });
}

pub fn idea_seen(app: &AppHandle, id: u64) {
    change(app, |inner, _| {
        inner.ideas.mark_seen(id);
        save(&mut inner.db, "idea", |db| db.mark_idea_seen(id));
    });
}

pub fn idea_delete(app: &AppHandle, id: u64) {
    change(app, |inner, _| {
        inner.ideas.delete(id);
        save(&mut inner.db, "idea", |db| db.delete_idea(id));
    });
}

/// Re-evaluates and emits `wisp://state` if anything changed. While the timer
/// runs the remaining time changes, so this sends once per tick.
pub fn refresh(app: &AppHandle) {
    let changed = {
        // `state` must live as long as the lock it hands out (a borrow
        // cannot outlive what it borrows from), so it gets its own variable.
        let state = app.state::<AppState>();
        let mut inner = state.lock();
        let now = Instant::now();
        inner.update(now);
        let snapshot = inner.snapshot(now);
        if inner.sent.as_ref() == Some(&snapshot) {
            None
        } else {
            inner.sent = Some(snapshot.clone());
            Some(snapshot)
        }
    }; // the lock is released here, before talking to the frontend
    if let Some(snapshot) = changed
        && let Err(error) = app.emit(STATE_EVENT, snapshot)
    {
        eprintln!("could not send the state: {error}");
    }
}

/// A window asks for the current snapshot once when it loads; after that it
/// just listens to `wisp://state`.
#[tauri::command]
pub fn current_snapshot(state: State<'_, AppState>) -> Snapshot {
    let mut inner = state.lock();
    let now = Instant::now();
    inner.update(now);
    inner.snapshot(now)
}
