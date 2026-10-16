//! Platform-independent core of Wisp.
//!
//! Everything here is plain Rust with no Tauri or OS dependency, so the
//! future macOS version can reuse it as-is.

pub mod hover;
pub mod ideas;
pub mod models;
pub mod state_machine;
pub mod timer;
