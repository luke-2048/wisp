//! UI text needed by the Rust side (the tray menu).
//!
//! The Italian strings live in `src/i18n/it.json`, shared with the frontend,
//! so there is a single place to edit them.

use std::collections::HashMap;

use serde::Deserialize;
use wisp_core::models::WispState;

/// The JSON file is copied into the binary at compile time.
const IT_JSON: &str = include_str!("../../src/i18n/it.json");

#[derive(Deserialize)]
pub struct Strings {
    pub tray: TrayStrings,
    states: HashMap<String, String>,
}

impl Strings {
    /// Italian name of a state, e.g. "Fai una pausa".
    // Only the debug menu uses it for now.
    #[cfg_attr(not(debug_assertions), allow(dead_code))]
    pub fn state_name(&self, state: WispState) -> &str {
        self.states
            .get(state.id())
            .map(String::as_str)
            .unwrap_or(state.id())
    }
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TrayStrings {
    pub tooltip: String,
    pub show_hide: String,
    pub settings: String,
    pub autostart: String,
    pub quit: String,
    #[cfg_attr(not(debug_assertions), allow(dead_code))]
    pub debug: String,
    #[cfg_attr(not(debug_assertions), allow(dead_code))]
    pub automatic: String,
}

/// Parses the Italian strings. The file ships inside the binary and a test
/// checks it, so a failure here is a programming error, hence `expect`.
pub fn italian() -> Strings {
    serde_json::from_str(IT_JSON).expect("src/i18n/it.json is malformed")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn italian_strings_parse() {
        assert_eq!(italian().tray.quit, "Esci");
    }

    #[test]
    fn every_state_has_an_italian_name() {
        let strings = italian();
        for state in WispState::ALL {
            assert!(strings.states.contains_key(state.id()), "{state:?}");
        }
        assert_eq!(strings.state_name(WispState::Break), "Fai una pausa");
    }
}
