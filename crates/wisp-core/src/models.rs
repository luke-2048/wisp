//! Shared data types.

use serde::{Deserialize, Serialize};

/// The six moods Wisp can be in. The frontend only draws them; the state
/// machine (`state_machine.rs`) decides which one is active.
// `derive` asks the compiler to write common trait implementations for us:
// Copy/Clone (cheap duplication), PartialEq/Eq (==), Debug ({:?} printing),
// Serialize/Deserialize (JSON for the frontend).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum WispState {
    Focused,
    Distracted,
    Break,
    Waiting,
    Done,
    Night,
}

impl WispState {
    pub const ALL: [WispState; 6] = [
        WispState::Focused,
        WispState::Distracted,
        WispState::Break,
        WispState::Waiting,
        WispState::Done,
        WispState::Night,
    ];

    /// The same name the frontend receives in JSON, e.g. `"break"`.
    pub fn id(self) -> &'static str {
        match self {
            WispState::Focused => "focused",
            WispState::Distracted => "distracted",
            WispState::Break => "break",
            WispState::Waiting => "waiting",
            WispState::Done => "done",
            WispState::Night => "night",
        }
    }

    pub fn from_id(id: &str) -> Option<WispState> {
        WispState::ALL.into_iter().find(|state| state.id() == id)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn state_uses_the_names_the_frontend_expects() {
        assert_eq!(
            serde_json::to_string(&WispState::Break).unwrap(),
            "\"break\""
        );
        let parsed: WispState = serde_json::from_str("\"night\"").unwrap();
        assert_eq!(parsed, WispState::Night);
    }

    #[test]
    fn id_matches_the_json_name_for_every_state() {
        for state in WispState::ALL {
            let json = serde_json::to_string(&state).unwrap();
            assert_eq!(json, format!("\"{}\"", state.id()));
            assert_eq!(WispState::from_id(state.id()), Some(state));
        }
        assert_eq!(WispState::from_id("sleepy"), None);
    }
}
