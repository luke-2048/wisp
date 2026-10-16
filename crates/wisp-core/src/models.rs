//! Shared data types.

use serde::{Deserialize, Serialize};

/// The six moods Wisp can be in. The frontend only draws them; the state
/// machine (added in step 2) decides which one is active.
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
}
