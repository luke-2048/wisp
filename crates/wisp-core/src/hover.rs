//! Opening and closing the island when the cursor hovers it.
//!
//! Pure logic: the caller says where the cursor is, whether a mouse button is
//! down and what time it is, and gets back what to do with the window.
//!
//! The closed bar must never get in the way of what is underneath (a browser
//! tab, its close button): when the cursor comes near, the bar fades out and
//! clicks go to the window below. The island opens only if the cursor rests on
//! the bar for a moment without clicking.

use std::time::{Duration, Instant};

/// How long the cursor must rest on the closed bar before the island opens.
pub const OPEN_DELAY: Duration = Duration::from_millis(350);

/// How far around the closed bar (logical pixels) the cursor makes it fade.
pub const NEAR_MARGIN: f64 = 24.0;

/// How long the cursor must stay away before the island closes. Short, but
/// not zero, so brushing past the edge by a pixel does not close it.
pub const CLOSE_DELAY: Duration = Duration::from_millis(80);

/// Length of the CSS closing animation (`src/island/island.css`); clicks start
/// passing through again only after it.
pub const CLOSE_ANIMATION: Duration = Duration::from_millis(340);

/// Where the cursor is, as seen by the caller at one instant.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub struct Cursor {
    /// Over the island's black shape (the bar when closed, the panel when open).
    pub inside: bool,
    /// Over the closed bar or within `NEAR_MARGIN` of it.
    pub near: bool,
    /// A mouse button is held down.
    pub pressed: bool,
}

/// What the window should do after an update.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum HoverAction {
    /// The cursor came near the closed bar: fade it out.
    Peek,
    /// The cursor went away without opening: show the bar again.
    Unpeek,
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
    /// Closed but faded, because the cursor is near.
    /// `since`: when the cursor got onto the bar, if it is on it.
    /// `blocked`: a click happened on the bar, so it must not open until the
    /// cursor leaves the bar and comes back.
    Peeking {
        since: Option<Instant>,
        blocked: bool,
    },
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
        matches!(self.phase, Phase::Open { .. } | Phase::Closing { .. })
    }

    /// While set, the island never closes (e.g. the user is typing in it).
    pub fn set_keep_open(&mut self, keep_open: bool) {
        self.keep_open = keep_open;
    }

    // `&mut self` means this method may change the tracker; Rust guarantees
    // nobody else is reading it at the same moment.
    pub fn update(&mut self, cursor: Cursor, now: Instant) -> Option<HoverAction> {
        match self.phase {
            Phase::Closed if cursor.near || cursor.inside => {
                self.phase = Phase::Peeking {
                    since: None,
                    blocked: false,
                };
                // Decide right away too: being on the bar starts the wait now.
                self.update(cursor, now);
                Some(HoverAction::Peek)
            }
            Phase::Closed => None,

            Phase::Peeking { .. } if !cursor.near && !cursor.inside => {
                self.phase = Phase::Closed;
                Some(HoverAction::Unpeek)
            }
            // Near, but not on the bar: the wait and the block start over.
            Phase::Peeking { .. } if !cursor.inside => {
                self.phase = Phase::Peeking {
                    since: None,
                    blocked: false,
                };
                None
            }
            Phase::Peeking { since, blocked } => {
                let since = since.unwrap_or(now);
                // A click on the bar belongs to the window underneath.
                let blocked = blocked || cursor.pressed;
                if !blocked && now.saturating_duration_since(since) >= OPEN_DELAY {
                    self.phase = Phase::Open { left_at: None };
                    Some(HoverAction::Expand)
                } else {
                    self.phase = Phase::Peeking {
                        since: Some(since),
                        blocked,
                    };
                    None
                }
            }

            Phase::Open { .. } if cursor.inside || self.keep_open => {
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
            Phase::Closing { .. } if cursor.inside => {
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

    const AWAY: Cursor = Cursor {
        inside: false,
        near: false,
        pressed: false,
    };
    const NEAR: Cursor = Cursor {
        inside: false,
        near: true,
        pressed: false,
    };
    const ON: Cursor = Cursor {
        inside: true,
        near: true,
        pressed: false,
    };
    const CLICK: Cursor = Cursor {
        inside: true,
        near: true,
        pressed: true,
    };

    /// A tracker that has just opened at time `t0` (after resting on the bar).
    fn opened(t0: Instant) -> HoverTracker {
        let mut tracker = HoverTracker::new();
        assert_eq!(tracker.update(ON, t0 - OPEN_DELAY), Some(HoverAction::Peek));
        assert_eq!(tracker.update(ON, t0), Some(HoverAction::Expand));
        tracker
    }

    #[test]
    fn stays_closed_without_the_cursor() {
        let mut tracker = HoverTracker::new();
        assert_eq!(tracker.update(AWAY, Instant::now()), None);
        assert!(!tracker.is_expanded());
    }

    #[test]
    fn fades_when_the_cursor_comes_near_and_back_when_it_leaves() {
        let t0 = Instant::now();
        let mut tracker = HoverTracker::new();
        assert_eq!(tracker.update(NEAR, t0), Some(HoverAction::Peek));
        assert_eq!(tracker.update(NEAR, t0 + ms(2000)), None);
        assert!(!tracker.is_expanded());
        assert_eq!(
            tracker.update(AWAY, t0 + ms(2100)),
            Some(HoverAction::Unpeek)
        );
    }

    #[test]
    fn opens_only_after_resting_on_the_bar() {
        let t0 = Instant::now();
        let mut tracker = HoverTracker::new();
        assert_eq!(tracker.update(ON, t0), Some(HoverAction::Peek));
        assert_eq!(tracker.update(ON, t0 + OPEN_DELAY - ms(1)), None);
        assert!(!tracker.is_expanded());
        assert_eq!(
            tracker.update(ON, t0 + OPEN_DELAY),
            Some(HoverAction::Expand)
        );
        assert!(tracker.is_expanded());
    }

    #[test]
    fn passing_over_the_bar_does_not_open() {
        let t0 = Instant::now();
        let mut tracker = HoverTracker::new();
        tracker.update(ON, t0);
        tracker.update(NEAR, t0 + ms(200)); // off the bar: the wait starts over
        assert_eq!(tracker.update(ON, t0 + ms(300)), None);
        assert_eq!(tracker.update(ON, t0 + ms(300) + OPEN_DELAY - ms(1)), None);
        assert!(!tracker.is_expanded());
    }

    #[test]
    fn a_click_on_the_bar_goes_underneath_and_blocks_opening() {
        let t0 = Instant::now();
        let mut tracker = HoverTracker::new();
        tracker.update(ON, t0);
        assert_eq!(tracker.update(CLICK, t0 + ms(100)), None);
        assert_eq!(tracker.update(ON, t0 + ms(5000)), None);
        assert!(!tracker.is_expanded());

        // Leaving the bar and coming back unblocks it.
        tracker.update(NEAR, t0 + ms(5100));
        tracker.update(ON, t0 + ms(5200));
        assert_eq!(
            tracker.update(ON, t0 + ms(5200) + OPEN_DELAY),
            Some(HoverAction::Expand)
        );
    }

    #[test]
    fn a_short_exit_does_not_close() {
        let t0 = Instant::now();
        let mut tracker = opened(t0);
        assert_eq!(tracker.update(AWAY, t0 + ms(100)), None);
        assert_eq!(
            tracker.update(AWAY, t0 + ms(100) + CLOSE_DELAY - ms(1)),
            None
        );
        let back = t0 + ms(100) + CLOSE_DELAY - ms(1);
        assert_eq!(tracker.update(ON, back), None);
        // The exit timer restarted: it counts from the new exit, not the old one.
        let left_again = back + ms(10);
        assert_eq!(tracker.update(AWAY, left_again), None);
        assert_eq!(tracker.update(AWAY, left_again + CLOSE_DELAY - ms(1)), None);
    }

    #[test]
    fn closes_after_the_delay_then_shrinks_after_the_animation() {
        let t0 = Instant::now();
        let mut tracker = opened(t0);
        let left = t0 + ms(100);
        assert_eq!(tracker.update(AWAY, left), None);
        assert_eq!(tracker.update(AWAY, left + CLOSE_DELAY - ms(1)), None);
        let collapse_at = left + CLOSE_DELAY;
        assert_eq!(
            tracker.update(AWAY, collapse_at),
            Some(HoverAction::Collapse)
        );
        assert!(tracker.is_expanded());
        let shrink_at = collapse_at + CLOSE_ANIMATION;
        assert_eq!(tracker.update(AWAY, shrink_at - ms(1)), None);
        assert_eq!(tracker.update(AWAY, shrink_at), Some(HoverAction::Shrink));
        assert!(!tracker.is_expanded());
    }

    #[test]
    fn coming_back_while_closing_opens_again() {
        let t0 = Instant::now();
        let mut tracker = opened(t0);
        tracker.update(AWAY, t0);
        assert_eq!(
            tracker.update(AWAY, t0 + CLOSE_DELAY),
            Some(HoverAction::Collapse)
        );
        assert_eq!(
            tracker.update(ON, t0 + CLOSE_DELAY + ms(50)),
            Some(HoverAction::Expand)
        );
        assert_eq!(tracker.update(ON, t0 + ms(2000)), None);
    }

    #[test]
    fn keep_open_prevents_closing() {
        let t0 = Instant::now();
        let mut tracker = opened(t0);
        tracker.set_keep_open(true);
        assert_eq!(tracker.update(AWAY, t0 + ms(100)), None);
        assert_eq!(tracker.update(AWAY, t0 + ms(5000)), None);
        tracker.set_keep_open(false);
        let left = t0 + ms(5100);
        assert_eq!(tracker.update(AWAY, left), None);
        assert_eq!(
            tracker.update(AWAY, left + CLOSE_DELAY),
            Some(HoverAction::Collapse)
        );
    }
}
