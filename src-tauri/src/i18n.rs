//! UI text needed by the Rust side (the tray menu).
//!
//! The Italian strings live in `src/i18n/it.json`, shared with the frontend,
//! so there is a single place to edit them.

use serde::Deserialize;

/// The JSON file is copied into the binary at compile time.
const IT_JSON: &str = include_str!("../../src/i18n/it.json");

#[derive(Deserialize)]
pub struct Strings {
    pub tray: TrayStrings,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TrayStrings {
    pub tooltip: String,
    pub show_hide: String,
    pub settings: String,
    pub autostart: String,
    pub quit: String,
}

/// Parses the Italian strings. The file ships inside the binary and a test
/// checks it, so a failure here is a programming error, hence `expect`.
pub fn italian() -> Strings {
    serde_json::from_str(IT_JSON).expect("src/i18n/it.json is malformed")
}

#[cfg(test)]
mod tests {
    #[test]
    fn italian_strings_parse() {
        assert_eq!(super::italian().tray.quit, "Esci");
    }
}
