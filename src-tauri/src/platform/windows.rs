//! Windows implementation of `Platform`.

use super::{ForeignWindow, Platform};
use tauri::{PhysicalPosition, PhysicalRect, PhysicalSize, WebviewWindow};
use windows::Win32::{
    Foundation::HWND,
    UI::WindowsAndMessaging::{
        GetForegroundWindow, LWA_ALPHA, SetForegroundWindow, SetLayeredWindowAttributes,
    },
};

pub struct WindowsPlatform;

impl Platform for WindowsPlatform {
    fn set_click_through(&self, window: &WebviewWindow, enabled: bool) -> tauri::Result<()> {
        window.set_ignore_cursor_events(enabled)?;
        if enabled {
            // Click-through turns the window into a "layered" window, and Windows
            // draws nothing for a layered window until its opacity is set.
            // `unsafe` marks a direct call into the Windows API, which Rust
            // cannot check for us; the handle comes straight from Tauri.
            let hwnd = window.hwnd()?;
            unsafe { SetLayeredWindowAttributes(hwnd, Default::default(), 255, LWA_ALPHA) }
                .map_err(std::io::Error::from)?;
        }
        Ok(())
    }

    /// "In alto al centro": glued to the top edge, centred horizontally.
    fn island_position(
        &self,
        monitor: PhysicalRect<i32, u32>,
        island: PhysicalSize<u32>,
    ) -> PhysicalPosition<i32> {
        // `as i32` converts between number types; widths are unsigned (u32)
        // but positions can be negative on monitors left of the main one.
        let free_width = monitor.size.width as i32 - island.width as i32;
        PhysicalPosition::new(monitor.position.x + free_width / 2, monitor.position.y)
    }

    fn foreground_window(&self) -> Option<ForeignWindow> {
        // SAFETY: no arguments; it only reads which window is active.
        let hwnd = unsafe { GetForegroundWindow() };
        (!hwnd.is_invalid()).then_some(ForeignWindow(hwnd.0 as isize))
    }

    fn focus_window(&self, window: ForeignWindow) {
        // Windows allows this because Wisp is the foreground app at this moment
        // (the user is typing in the park window). If the remembered window
        // was closed meanwhile, the call simply fails and nothing happens.
        let hwnd = HWND(window.0 as *mut std::ffi::c_void);
        let _ = unsafe { SetForegroundWindow(hwnd) };
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn monitor(x: i32, y: i32, width: u32, height: u32) -> PhysicalRect<i32, u32> {
        PhysicalRect {
            position: PhysicalPosition::new(x, y),
            size: PhysicalSize::new(width, height),
        }
    }

    #[test]
    fn island_is_centred_at_the_top() {
        let pos =
            WindowsPlatform.island_position(monitor(0, 0, 1920, 1080), PhysicalSize::new(300, 84));
        assert_eq!(pos, PhysicalPosition::new(810, 0));
    }

    #[test]
    fn island_follows_a_monitor_that_is_not_at_the_origin() {
        // 150% scale: the 300x84 island is 450x126 physical pixels.
        let pos = WindowsPlatform.island_position(
            monitor(-2560, -200, 2560, 1440),
            PhysicalSize::new(450, 126),
        );
        assert_eq!(pos, PhysicalPosition::new(-2560 + 1055, -200));
    }
}
