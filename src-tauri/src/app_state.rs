//! The app's live state: keeps the facts, asks the core state machine which
//! state Wisp is in, and tells the frontend whenever it changes.

use std::{
    sync::{Mutex, MutexGuard},
    thread,
    time::{Duration, Instant},
};

use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager, State};
use wisp_core::{
    models::WispState,
    state_machine::{self, StateInput, StateRules},
};

/// Event carrying a fresh `Snapshot` to the frontend.
const STATE_EVENT: &str = "wisp://state";

/// Time-based rules (end of "Fatto!", night) are re-checked this often.
const TICK: Duration = Duration::from_secs(1);

/// Everything the frontend needs to draw. Step 4 adds task and timer.
#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct Snapshot {
    pub state: WispState,
}

#[derive(Default)]
struct Inner {
    input: StateInput,
    rules: StateRules,
    /// The last snapshot sent, so we only emit real changes.
    sent: Option<Snapshot>,
}

impl Inner {
    fn snapshot(&self) -> Snapshot {
        Snapshot {
            state: state_machine::evaluate(
                &self.input,
                &self.rules,
                Instant::now(),
                chrono::Local::now().time(),
            ),
        }
    }
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

/// Starts the 1 s tick that catches time-based changes.
pub fn start_ticking(app: AppHandle) {
    thread::spawn(move || {
        loop {
            thread::sleep(TICK);
            refresh(&app);
        }
    });
}

/// Debug menu: `Some(state)` forces a state, `None` goes back to automatic.
// Only the debug menu calls it for now.
#[cfg_attr(not(debug_assertions), allow(dead_code))]
pub fn force(app: &AppHandle, state: Option<WispState>) {
    app.state::<AppState>().lock().input.forced = state;
    refresh(app);
}

/// The user opened the island: whatever was waiting has been seen.
pub fn island_opened(app: &AppHandle) {
    app.state::<AppState>().lock().input.waiting = false;
    refresh(app);
}

/// Re-evaluates and emits `wisp://state` if anything changed.
pub fn refresh(app: &AppHandle) {
    let changed = {
        // `state` must live as long as the lock it hands out (a borrow
        // cannot outlive what it borrows from), so it gets its own variable.
        let state = app.state::<AppState>();
        let mut inner = state.lock();
        let snapshot = inner.snapshot();
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
    state.lock().snapshot()
}
