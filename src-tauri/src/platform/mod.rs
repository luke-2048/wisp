//! OS-specific behaviour behind a common interface.
//!
//! Each operating system gets its own file (only `windows.rs` for now); the
//! rest of the app talks to the `Platform` trait and never to the OS directly.

use tauri::{PhysicalPosition, PhysicalRect, PhysicalSize, WebviewWindow};

#[cfg(target_os = "windows")]
mod windows;

/// A `trait` is a list of methods a type promises to provide, like an
/// interface. The macOS version will add its own type implementing it.
pub trait Platform {
    /// When enabled, clicks pass through the window to whatever is underneath,
    /// while the window stays fully visible.
    fn set_click_through(&self, window: &WebviewWindow, enabled: bool) -> tauri::Result<()>;

    /// Top-left corner of the island window on the given monitor.
    /// Everything is in physical pixels, so DPI scaling is already applied.
    fn island_position(
        &self,
        monitor: PhysicalRect<i32, u32>,
        island: PhysicalSize<u32>,
    ) -> PhysicalPosition<i32>;
}

/// The platform Wisp is running on.
#[cfg(target_os = "windows")]
pub fn current() -> impl Platform {
    windows::WindowsPlatform
}
