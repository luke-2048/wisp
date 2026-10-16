//! Which state Wisp is in, as a pure function of the facts and the time.
//!
//! Priority when several rules match:
//! `done` > `waiting` > `night` > `break` > `distracted` > `focused`.
//! `distracted` is not automatic in v0.1: it only comes from the debug menu.

use std::time::{Duration, Instant};

use chrono::NaiveTime;

use crate::models::WispState;

/// How long Wisp celebrates after "Fatto".
pub const DONE_DURATION: Duration = Duration::from_secs(4);

/// The facts the state depends on. The app keeps them up to date; this module
/// only reads them.
#[derive(Debug, Clone, Default)]
pub struct StateInput {
    /// Chosen from the debug menu; wins over everything until "Automatico".
    pub forced: Option<WispState>,
    /// "Fatto" was pressed: celebrate until this moment.
    pub done_until: Option<Instant>,
    /// The timer ended and the user has not opened the island since.
    pub waiting: bool,
    /// Running timer time since the last real pause (step 4 keeps it).
    pub focus_streak: Duration,
}

/// The thresholds, configurable in settings (step 6).
#[derive(Debug, Clone)]
pub struct StateRules {
    pub break_after: Duration,
    pub night_start: NaiveTime,
    pub night_end: NaiveTime,
}

impl Default for StateRules {
    fn default() -> Self {
        Self {
            break_after: Duration::from_secs(90 * 60),
            // `expect` is fine here: these are fixed, valid times.
            night_start: NaiveTime::from_hms_opt(23, 0, 0).expect("valid time"),
            night_end: NaiveTime::from_hms_opt(5, 0, 0).expect("valid time"),
        }
    }
}

/// Decides the state. `now` measures durations, `local_time` is the wall
/// clock for the night rule; both come from the caller, never from inside.
// `&StateInput` is a borrow: we read the input without taking ownership of it,
// so the caller still has it afterwards.
pub fn evaluate(
    input: &StateInput,
    rules: &StateRules,
    now: Instant,
    local_time: NaiveTime,
) -> WispState {
    if let Some(forced) = input.forced {
        return forced;
    }
    if input.done_until.is_some_and(|until| now < until) {
        WispState::Done
    } else if input.waiting {
        WispState::Waiting
    } else if is_night(rules, local_time) {
        WispState::Night
    } else if input.focus_streak >= rules.break_after {
        WispState::Break
    } else {
        WispState::Focused
    }
}

/// The night may cross midnight (23:00 to 05:00) or not (e.g. 20:00 to 23:00).
fn is_night(rules: &StateRules, time: NaiveTime) -> bool {
    if rules.night_start <= rules.night_end {
        rules.night_start <= time && time < rules.night_end
    } else {
        time >= rules.night_start || time < rules.night_end
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn at(hour: u32, minute: u32) -> NaiveTime {
        NaiveTime::from_hms_opt(hour, minute, 0).unwrap()
    }

    fn minutes(n: u64) -> Duration {
        Duration::from_secs(n * 60)
    }

    fn state(input: &StateInput, time: NaiveTime) -> WispState {
        evaluate(input, &StateRules::default(), Instant::now(), time)
    }

    #[test]
    fn focused_by_default() {
        assert_eq!(state(&StateInput::default(), at(10, 0)), WispState::Focused);
    }

    #[test]
    fn break_after_90_minutes_of_focus() {
        let mut input = StateInput {
            focus_streak: minutes(90) - Duration::from_secs(1),
            ..StateInput::default()
        };
        assert_eq!(state(&input, at(10, 0)), WispState::Focused);
        input.focus_streak = minutes(90);
        assert_eq!(state(&input, at(10, 0)), WispState::Break);
    }

    #[test]
    fn night_from_23_to_5() {
        let input = StateInput::default();
        assert_eq!(state(&input, at(22, 59)), WispState::Focused);
        assert_eq!(state(&input, at(23, 0)), WispState::Night);
        assert_eq!(state(&input, at(2, 30)), WispState::Night);
        assert_eq!(state(&input, at(4, 59)), WispState::Night);
        assert_eq!(state(&input, at(5, 0)), WispState::Focused);
    }

    #[test]
    fn night_that_does_not_cross_midnight() {
        let rules = StateRules {
            night_start: at(20, 0),
            night_end: at(23, 0),
            ..StateRules::default()
        };
        let input = StateInput::default();
        let now = Instant::now();
        assert_eq!(
            evaluate(&input, &rules, now, at(19, 59)),
            WispState::Focused
        );
        assert_eq!(evaluate(&input, &rules, now, at(21, 0)), WispState::Night);
        assert_eq!(evaluate(&input, &rules, now, at(23, 0)), WispState::Focused);
    }

    #[test]
    fn done_lasts_four_seconds_then_the_previous_state_returns() {
        let pressed = Instant::now();
        let input = StateInput {
            done_until: Some(pressed + DONE_DURATION),
            ..StateInput::default()
        };
        let rules = StateRules::default();
        let after = |secs| pressed + Duration::from_secs(secs);
        assert_eq!(
            evaluate(&input, &rules, after(3), at(10, 0)),
            WispState::Done
        );
        assert_eq!(
            evaluate(&input, &rules, after(4), at(10, 0)),
            WispState::Focused
        );
    }

    #[test]
    fn priority_done_waiting_night_break() {
        let now = Instant::now();
        let rules = StateRules::default();
        let mut input = StateInput {
            done_until: Some(now + DONE_DURATION),
            waiting: true,
            focus_streak: minutes(120),
            ..StateInput::default()
        };
        let midnight = at(0, 0);
        assert_eq!(evaluate(&input, &rules, now, midnight), WispState::Done);
        input.done_until = None;
        assert_eq!(evaluate(&input, &rules, now, midnight), WispState::Waiting);
        input.waiting = false;
        assert_eq!(evaluate(&input, &rules, now, midnight), WispState::Night);
        assert_eq!(evaluate(&input, &rules, now, at(10, 0)), WispState::Break);
    }

    #[test]
    fn forced_state_wins_until_cleared() {
        let mut input = StateInput {
            forced: Some(WispState::Distracted),
            waiting: true,
            ..StateInput::default()
        };
        assert_eq!(state(&input, at(10, 0)), WispState::Distracted);
        input.forced = None;
        assert_eq!(state(&input, at(10, 0)), WispState::Waiting);
    }
}
