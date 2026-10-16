//! Opening and closing the island when the cursor hovers it.
//!
//! Pure logic: the caller says whether the cursor is over the island and what
//! time it is, and gets back what to do with the window.

use std::time::{Duration, Instant};

/// How long the cursor must stay away before the island closes.
pub const CLOSE_DELAY: Duration = Duration::from_millis(600);

/// Length of the CSS closing animation; the window shrinks only after it.
pub const CLOSE_ANIMATION: Duration = Duration::from_millis(250);

/// What the window should do after an update.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum HoverAction {
    /// Grow the window to the open size at once and start the opening animation.
    Expand,
    /// Start the closing animation; the window keeps its open size for now.
    Collapse,
    /// The animation is over: shrink the window and let clicks pass through again.
    Shrink,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
enum Phase {
    #[default]
    Closed,
    /// `left_at` is when the cursor left the island, if it is outside.
    Open {
        left_at: Option<Instant>,
    },
    Closing {
        until: Instant,
    },
}

#[derive(Debug, Default)]
pub struct HoverTracker {
    phase: Phase,
    keep_open: bool,
}

impl HoverTracker {
    pub fn new() -> Self {
        Self::default()
    }

    /// True while the window has (or keeps) its open size.
    pub fn is_expanded(&self) -> bool {
        self.phase != Phase::Closed
    }

    /// While set, the island never closes (e.g. the user is typing in it).
    pub fn set_keep_open(&mut self, keep_open: bool) {
        self.keep_open = keep_open;
    }

    // `&mut self` means this method may change the tracker; Rust guarantees
    // nobody else is reading it at the same moment.
    pub fn update(&mut self, inside: bool, now: Instant) -> Option<HoverAction> {
        match self.phase {
            Phase::Closed if inside => {
                self.phase = Phase::Open { left_at: None };
                Some(HoverAction::Expand)
            }
            Phase::Closed => None,

            Phase::Open { .. } if inside || self.keep_open => {
                self.phase = Phase::Open { left_at: None };
                None
            }
            Phase::Open { left_at: None } => {
                self.phase = Phase::Open { left_at: Some(now) };
                None
            }
            Phase::Open {
                left_at: Some(left_at),
            } => {
                if now.saturating_duration_since(left_at) >= CLOSE_DELAY {
                    self.phase = Phase::Closing {
                        until: now + CLOSE_ANIMATION,
                    };
                    Some(HoverAction::Collapse)
                } else {
                    None
                }
            }

            // Back inside while closing: open again.
            Phase::Closing { .. } if inside => {
                self.phase = Phase::Open { left_at: None };
                Some(HoverAction::Expand)
            }
            Phase::Closing { until } if now >= until => {
                self.phase = Phase::Closed;
                Some(HoverAction::Shrink)
            }
            Phase::Closing { .. } => None,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn ms(n: u64) -> Duration {
        Duration::from_millis(n)
    }

    /// A tracker that has just opened at time `t0`.
    fn opened(t0: Instant) -> HoverTracker {
        let mut tracker = HoverTracker::new();
        assert_eq!(tracker.update(true, t0), Some(HoverAction::Expand));
        tracker
    }

    #[test]
    fn stays_closed_without_the_cursor() {
        let mut tracker = HoverTracker::new();
        assert_eq!(tracker.update(false, Instant::now()), None);
        assert!(!tracker.is_expanded());
    }

    #[test]
    fn opens_as_soon_as_the_cursor_enters() {
        let tracker = opened(Instant::now());
        assert!(tracker.is_expanded());
    }

    #[test]
    fn a_short_exit_does_not_close() {
        let t0 = Instant::now();
        let mut tracker = opened(t0);
        assert_eq!(tracker.update(false, t0 + ms(100)), None);
        assert_eq!(tracker.update(false, t0 + ms(500)), None);
        assert_eq!(tracker.update(true, t0 + ms(650)), None);
        // The exit timer restarted: 600 ms from the new exit, not the old one.
        assert_eq!(tracker.update(false, t0 + ms(700)), None);
        assert_eq!(tracker.update(false, t0 + ms(1200)), None);
    }

    #[test]
    fn closes_600_ms_after_leaving_then_shrinks_after_the_animation() {
        let t0 = Instant::now();
        let mut tracker = opened(t0);
        assert_eq!(tracker.update(false, t0 + ms(100)), None);
        assert_eq!(tracker.update(false, t0 + ms(699)), None);
        assert_eq!(
            tracker.update(false, t0 + ms(700)),
            Some(HoverAction::Collapse)
        );
        assert!(tracker.is_expanded());
        assert_eq!(tracker.update(false, t0 + ms(900)), None);
        assert_eq!(
            tracker.update(false, t0 + ms(950)),
            Some(HoverAction::Shrink)
        );
        assert!(!tracker.is_expanded());
    }

    #[test]
    fn coming_back_while_closing_opens_again() {
        let t0 = Instant::now();
        let mut tracker = opened(t0);
        tracker.update(false, t0);
        assert_eq!(
            tracker.update(false, t0 + ms(600)),
            Some(HoverAction::Collapse)
        );
        assert_eq!(
            tracker.update(true, t0 + ms(700)),
            Some(HoverAction::Expand)
        );
        assert_eq!(tracker.update(true, t0 + ms(2000)), None);
    }

    #[test]
    fn keep_open_prevents_closing() {
        let t0 = Instant::now();
        let mut tracker = opened(t0);
        tracker.set_keep_open(true);
        assert_eq!(tracker.update(false, t0 + ms(100)), None);
        assert_eq!(tracker.update(false, t0 + ms(5000)), None);
        tracker.set_keep_open(false);
        assert_eq!(tracker.update(false, t0 + ms(5100)), None);
        assert_eq!(
            tracker.update(false, t0 + ms(5700)),
            Some(HoverAction::Collapse)
        );
    }
}
