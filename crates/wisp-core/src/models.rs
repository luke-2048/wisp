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

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum PaletteName {
    #[default]
    Lilla,
    Menta,
    Pesca,
}

/// Everything the user can change in the settings window. `serde(default)`
/// means a value missing from the database gets its default, so adding a
/// setting later never breaks old data.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(default)]
pub struct Settings {
    pub palette: PaletteName,
    /// Tauri accelerator syntax. `CommandOrControl` is Ctrl on Windows and
    /// Cmd on macOS, so the same value works for both versions.
    pub park_shortcut: String,
    /// Pre-filled in the "Altro…" timer field.
    pub custom_minutes: u32,
    /// Running timer time after which Wisp suggests a break.
    pub break_after_minutes: u32,
    /// "HH:MM", local time.
    pub night_start: String,
    pub night_end: String,
}

pub const DEFAULT_PARK_SHORTCUT: &str = "CommandOrControl+Shift+Space";

impl Default for Settings {
    fn default() -> Self {
        Self {
            palette: PaletteName::Lilla,
            park_shortcut: DEFAULT_PARK_SHORTCUT.to_string(),
            custom_minutes: 30,
            break_after_minutes: 90,
            night_start: "23:00".to_string(),
            night_end: "05:00".to_string(),
        }
    }
}

impl Settings {
    /// Brings every value back into a sensible range; an unreadable time or an
    /// empty shortcut falls back to its default.
    pub fn sanitized(mut self) -> Self {
        let defaults = Settings::default();
        self.custom_minutes = self.custom_minutes.clamp(1, 240);
        self.break_after_minutes = self.break_after_minutes.clamp(15, 240);
        if parse_time(&self.night_start).is_none() {
            self.night_start = defaults.night_start;
        }
        if parse_time(&self.night_end).is_none() {
            self.night_end = defaults.night_end;
        }
        if self.park_shortcut.trim().is_empty() {
            self.park_shortcut = defaults.park_shortcut;
        }
        self
    }
}

/// "23:00" -> 23:00. `None` if it is not a valid time.
pub fn parse_time(text: &str) -> Option<chrono::NaiveTime> {
    chrono::NaiveTime::parse_from_str(text.trim(), "%H:%M").ok()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn settings_out_of_range_are_brought_back() {
        let settings = Settings {
            custom_minutes: 0,
            break_after_minutes: 5000,
            night_start: "25:99".into(),
            night_end: "6:30".into(),
            park_shortcut: "  ".into(),
            ..Settings::default()
        }
        .sanitized();
        assert_eq!(settings.custom_minutes, 1);
        assert_eq!(settings.break_after_minutes, 240);
        assert_eq!(settings.night_start, "23:00");
        assert_eq!(settings.night_end, "6:30");
        assert_eq!(settings.park_shortcut, DEFAULT_PARK_SHORTCUT);
    }

    #[test]
    fn missing_settings_get_their_default() {
        let settings: Settings = serde_json::from_str(r#"{"palette":"menta"}"#).unwrap();
        assert_eq!(settings.palette, PaletteName::Menta);
        assert_eq!(settings.break_after_minutes, 90);
    }

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
