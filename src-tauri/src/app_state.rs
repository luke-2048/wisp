//! The app's live state: keeps the facts (task, timer, flags), asks the core
//! state machine which state Wisp is in, and tells the frontend whenever
//! something changes.

use std::{
    sync::{Mutex, MutexGuard},
    thread,
    time::{Duration, Instant},
};

use chrono::{DateTime, Local};
use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager, State};
use wisp_core::{
    ideas::{Ideas, ParkedIdea},
    models::WispState,
    state_machine::{self, DONE_DURATION, StateInput, StateRules},
    timer::{FocusTimer, TimerEvent, TimerStatus},
};

/// Event carrying a fresh `Snapshot` to the frontend.
const STATE_EVENT: &str = "wisp://state";

/// The timer and the time-based rules are re-checked this often.
const TICK: Duration = Duration::from_secs(1);

/// Longest task title we keep; the field is one line.
const MAX_TASK_CHARS: usize = 200;

/// Shortest and longest timer the user can start, in minutes.
const TIMER_MINUTES: std::ops::RangeInclusive<u32> = 1..=240;

/// Everything the frontend needs to draw.
#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct Snapshot {
    pub state: WispState,
    pub task: Option<String>,
    pub timer: TimerSnapshot,
    /// Newest first.
    pub ideas: Vec<ParkedIdea>,
    pub unseen_ideas: usize,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct TimerSnapshot {
    pub status: TimerStatus,
    /// The frontend counts down from here on its own clock, between ticks.
    pub remaining_ms: u64,
    pub total_ms: u64,
}

/// A task marked "Fatto". Kept in memory for now; step 6 saves it to SQLite.
#[allow(dead_code)] // read when persistence arrives (step 6)
struct DoneTask {
    title: String,
    done_at: DateTime<Local>,
}

#[derive(Default)]
struct Inner {
    input: StateInput,
    rules: StateRules,
    task: Option<String>,
    timer: FocusTimer,
    done_today: Vec<DoneTask>,
    ideas: Ideas,
    /// The last snapshot sent, so we only emit real changes.
    sent: Option<Snapshot>,
}

impl Inner {
    /// Advances the timer and copies its facts into the state machine input.
    fn update(&mut self, now: Instant) {
        if self.timer.tick(now) == Some(TimerEvent::Finished) {
            self.input.waiting = true;
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
        }
    }
}

fn millis(duration: Duration) -> u64 {
    u64::try_from(duration.as_millis()).unwrap_or(u64::MAX)
}

/// Shared by the tray, the island and the frontend commands, behind a lock.
#[derive(Default)]
pub struct AppState(Mutex<Inner>);

impl AppState {
    fn lock(&self) -> MutexGuard<'_, Inner> {
        self.0
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
    }
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
    change(app, |inner, _| {
        inner.task = (!title.is_empty()).then_some(title);
    });
}

/// "Fatto": Wisp celebrates, the task goes to today's list, the field empties
/// and the timer stops, ready for the next task.
pub fn task_done(app: &AppHandle) {
    change(app, |inner, now| {
        if let Some(title) = inner.task.take() {
            inner.done_today.push(DoneTask {
                title,
                done_at: Local::now(),
            });
            inner.input.done_until = Some(now + DONE_DURATION);
            inner.timer.stop(now);
        }
    });
}

pub fn timer_start(app: &AppHandle, minutes: u32) {
    let minutes = minutes.clamp(*TIMER_MINUTES.start(), *TIMER_MINUTES.end());
    change(app, |inner, now| {
        inner
            .timer
            .start(Duration::from_secs(u64::from(minutes) * 60), now);
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
    change(app, |inner, now| inner.timer.stop(now));
}

pub fn park_idea(app: &AppHandle, text: &str) {
    change(app, |inner, _| {
        inner.ideas.park(text, Local::now().timestamp_millis());
    });
}

pub fn idea_seen(app: &AppHandle, id: u64) {
    change(app, |inner, _| inner.ideas.mark_seen(id));
}

pub fn idea_delete(app: &AppHandle, id: u64) {
    change(app, |inner, _| inner.ideas.delete(id));
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

/// The frontend asks for the current snapshot once when it loads; after that
/// it just listens to `wisp://state`.
#[tauri::command]
pub fn current_snapshot(state: State<'_, AppState>) -> Snapshot {
    let mut inner = state.lock();
    let now = Instant::now();
    inner.update(now);
    inner.snapshot(now)
}
