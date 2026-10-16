//! The focus timer, plus the "focus streak" that tells when to suggest a break.
//!
//! Pure logic: every method receives the current time.

use std::time::{Duration, Instant};

use serde::Serialize;

/// A pause, stop or finished timer resets the focus streak only if no timer
/// runs for at least this long.
pub const STREAK_RESET_AFTER: Duration = Duration::from_secs(5 * 60);

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum TimerStatus {
    #[default]
    Idle,
    Running,
    Paused,
}

#[derive(Debug, PartialEq, Eq)]
pub enum TimerEvent {
    Finished,
}

#[derive(Debug, Clone, Copy, Default)]
enum Phase {
    #[default]
    Idle,
    Running {
        ends_at: Instant,
    },
    Paused {
        remaining: Duration,
    },
}

#[derive(Debug, Default)]
pub struct FocusTimer {
    phase: Phase,
    total: Duration,
    /// Focus time from earlier runs that still belongs to the current streak.
    streak_banked: Duration,
    /// When the current run started, while a timer runs.
    running_since: Option<Instant>,
    /// When the last run ended (pause, stop or finish), while none runs.
    idle_since: Option<Instant>,
}

impl FocusTimer {
    pub fn new() -> Self {
        Self::default()
    }

    /// Starts a new timer. Starting while one runs replaces it.
    pub fn start(&mut self, duration: Duration, now: Instant) {
        self.end_run(now);
        self.begin_run(now);
        self.total = duration;
        self.phase = Phase::Running {
            ends_at: now + duration,
        };
    }

    pub fn pause(&mut self, now: Instant) {
        if let Phase::Running { .. } = self.phase {
            let remaining = self.remaining(now);
            self.end_run(now);
            self.phase = Phase::Paused { remaining };
        }
    }

    pub fn resume(&mut self, now: Instant) {
        if let Phase::Paused { remaining } = self.phase {
            self.begin_run(now);
            self.phase = Phase::Running {
                ends_at: now + remaining,
            };
        }
    }

    pub fn stop(&mut self, now: Instant) {
        self.end_run(now);
        self.phase = Phase::Idle;
    }

    /// Call regularly: reports when the timer reaches zero.
    pub fn tick(&mut self, now: Instant) -> Option<TimerEvent> {
        match self.phase {
            Phase::Running { ends_at } if now >= ends_at => {
                // The run ended at `ends_at`, even if we notice it a bit later.
                self.end_run(ends_at);
                self.phase = Phase::Idle;
                Some(TimerEvent::Finished)
            }
            _ => None,
        }
    }

    pub fn status(&self) -> TimerStatus {
        match self.phase {
            Phase::Idle => TimerStatus::Idle,
            Phase::Running { .. } => TimerStatus::Running,
            Phase::Paused { .. } => TimerStatus::Paused,
        }
    }

    /// Length of the timer that was started (zero when idle).
    pub fn total(&self) -> Duration {
        match self.phase {
            Phase::Idle => Duration::ZERO,
            _ => self.total,
        }
    }

    pub fn remaining(&self, now: Instant) -> Duration {
        match self.phase {
            Phase::Idle => Duration::ZERO,
            Phase::Running { ends_at } => ends_at.saturating_duration_since(now),
            Phase::Paused { remaining } => remaining,
        }
    }

    /// Running time since the last real rest (5 min without a timer).
    pub fn focus_streak(&self, now: Instant) -> Duration {
        if self.rested(now) {
            return Duration::ZERO;
        }
        let current_run = match (self.running_since, self.phase) {
            (Some(since), Phase::Running { ends_at }) => {
                now.min(ends_at).saturating_duration_since(since)
            }
            _ => Duration::ZERO,
        };
        self.streak_banked + current_run
    }

    fn rested(&self, now: Instant) -> bool {
        self.idle_since
            .is_some_and(|since| now.saturating_duration_since(since) >= STREAK_RESET_AFTER)
    }

    fn begin_run(&mut self, now: Instant) {
        if self.rested(now) {
            self.streak_banked = Duration::ZERO;
        }
        self.idle_since = None;
        self.running_since = Some(now);
    }

    fn end_run(&mut self, at: Instant) {
        // `take()` moves the value out and leaves `None` behind.
        if let Some(since) = self.running_since.take() {
            self.streak_banked += at.saturating_duration_since(since);
            self.idle_since = Some(at);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn mins(n: u64) -> Duration {
        Duration::from_secs(n * 60)
    }

    fn secs(n: u64) -> Duration {
        Duration::from_secs(n)
    }

    #[test]
    fn counts_down_and_finishes() {
        let t0 = Instant::now();
        let mut timer = FocusTimer::new();
        timer.start(mins(15), t0);
        assert_eq!(timer.status(), TimerStatus::Running);
        assert_eq!(timer.remaining(t0 + mins(5)), mins(10));
        assert_eq!(timer.tick(t0 + mins(15) - secs(1)), None);
        assert_eq!(timer.tick(t0 + mins(15)), Some(TimerEvent::Finished));
        assert_eq!(timer.status(), TimerStatus::Idle);
        assert_eq!(timer.tick(t0 + mins(16)), None);
    }

    #[test]
    fn pause_keeps_the_remaining_time() {
        let t0 = Instant::now();
        let mut timer = FocusTimer::new();
        timer.start(mins(25), t0);
        timer.pause(t0 + mins(10));
        assert_eq!(timer.status(), TimerStatus::Paused);
        assert_eq!(timer.remaining(t0 + mins(40)), mins(15));
        assert_eq!(timer.tick(t0 + mins(40)), None);
        timer.resume(t0 + mins(40));
        assert_eq!(timer.remaining(t0 + mins(45)), mins(10));
        assert_eq!(timer.tick(t0 + mins(55)), Some(TimerEvent::Finished));
    }

    #[test]
    fn stop_clears_the_timer() {
        let t0 = Instant::now();
        let mut timer = FocusTimer::new();
        timer.start(mins(25), t0);
        timer.stop(t0 + mins(1));
        assert_eq!(timer.status(), TimerStatus::Idle);
        assert_eq!(timer.remaining(t0 + mins(2)), Duration::ZERO);
        assert_eq!(timer.total(), Duration::ZERO);
    }

    #[test]
    fn streak_counts_only_running_time() {
        let t0 = Instant::now();
        let mut timer = FocusTimer::new();
        timer.start(mins(45), t0);
        assert_eq!(timer.focus_streak(t0 + mins(20)), mins(20));
        timer.pause(t0 + mins(20));
        assert_eq!(timer.focus_streak(t0 + mins(23)), mins(20));
        timer.resume(t0 + mins(23));
        assert_eq!(timer.focus_streak(t0 + mins(33)), mins(30));
    }

    #[test]
    fn a_pause_shorter_than_five_minutes_keeps_the_streak() {
        let t0 = Instant::now();
        let mut timer = FocusTimer::new();
        timer.start(mins(45), t0);
        assert_eq!(timer.tick(t0 + mins(45)), Some(TimerEvent::Finished));
        let restart = t0 + mins(45) + mins(5) - secs(1);
        assert_eq!(timer.focus_streak(restart), mins(45));
        timer.start(mins(45), restart);
        assert_eq!(timer.focus_streak(restart + mins(45)), mins(90));
    }

    #[test]
    fn five_minutes_without_a_timer_reset_the_streak() {
        let t0 = Instant::now();
        let mut timer = FocusTimer::new();
        timer.start(mins(45), t0);
        timer.stop(t0 + mins(40));
        let rested = t0 + mins(45);
        assert_eq!(timer.focus_streak(rested - secs(1)), mins(40));
        assert_eq!(timer.focus_streak(rested), Duration::ZERO);
        timer.start(mins(25), rested);
        assert_eq!(timer.focus_streak(rested + mins(10)), mins(10));
    }

    #[test]
    fn streak_does_not_grow_after_the_timer_ends_unnoticed() {
        let t0 = Instant::now();
        let mut timer = FocusTimer::new();
        timer.start(mins(15), t0);
        // Nobody ticked yet, but time past the end is not focus.
        assert_eq!(timer.focus_streak(t0 + mins(16)), mins(15));
    }
}
