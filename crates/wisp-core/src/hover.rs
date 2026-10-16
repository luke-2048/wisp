//! Opening and closing the island when the cursor hovers it.
//!
//! Pure logic: the caller says whether the cursor is over the island and what
//! time it is, and gets back what to do with the window.

use std::time::{Duration, Instant};

/// How long the cursor must stay away before the island closes. Short, but
/// not zero, so brushing past the edge by a pixel does not close it.
pub const CLOSE_DELAY: Duration = Duration::from_millis(150);

/// Length of the CSS closing animation (`src/island/island.css`); clicks start
/// passing through again only after it.
pub const CLOSE_ANIMATION: Duration = Duration::from_millis(340);

/// What the window should do after an update.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum HoverAction {
    /// Stop letting clicks through and start the opening animation.
    Expand,
    /// Start the closing animation.
    Collapse,
    /// The animation is over: let clicks pass through again.
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

    /// True while the island is open or still playing its closing animation.
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
        assert_eq!(
            tracker.update(false, t0 + ms(100) + CLOSE_DELAY - ms(1)),
            None
        );
        let back = t0 + ms(100) + CLOSE_DELAY - ms(1);
        assert_eq!(tracker.update(true, back), None);
        // The exit timer restarted: it counts from the new exit, not the old one.
        let left_again = back + ms(10);
        assert_eq!(tracker.update(false, left_again), None);
        assert_eq!(
            tracker.update(false, left_again + CLOSE_DELAY - ms(1)),
            None
        );
    }

    #[test]
    fn closes_after_the_delay_then_shrinks_after_the_animation() {
        let t0 = Instant::now();
        let mut tracker = opened(t0);
        let left = t0 + ms(100);
        assert_eq!(tracker.update(false, left), None);
        assert_eq!(tracker.update(false, left + CLOSE_DELAY - ms(1)), None);
        let collapse_at = left + CLOSE_DELAY;
        assert_eq!(
            tracker.update(false, collapse_at),
            Some(HoverAction::Collapse)
        );
        assert!(tracker.is_expanded());
        let shrink_at = collapse_at + CLOSE_ANIMATION;
        assert_eq!(tracker.update(false, shrink_at - ms(1)), None);
        assert_eq!(tracker.update(false, shrink_at), Some(HoverAction::Shrink));
        assert!(!tracker.is_expanded());
    }

    #[test]
    fn coming_back_while_closing_opens_again() {
        let t0 = Instant::now();
        let mut tracker = opened(t0);
        tracker.update(false, t0);
        assert_eq!(
            tracker.update(false, t0 + CLOSE_DELAY),
            Some(HoverAction::Collapse)
        );
        assert_eq!(
            tracker.update(true, t0 + CLOSE_DELAY + ms(50)),
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
        let left = t0 + ms(5100);
        assert_eq!(tracker.update(false, left), None);
        assert_eq!(
            tracker.update(false, left + CLOSE_DELAY),
            Some(HoverAction::Collapse)
        );
    }
}
