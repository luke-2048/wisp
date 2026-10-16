//! The island window: where it sits and how it behaves when closed.

use std::{thread, time::Duration};

use tauri::{AppHandle, LogicalSize, Manager, PhysicalRect, WebviewWindow};

use crate::platform::{self, Platform};

/// Window label, as declared in `tauri.conf.json`.
const LABEL: &str = "island";

/// Closed island size in logical pixels, i.e. before Windows' display scaling.
const CLOSED_SIZE: LogicalSize<f64> = LogicalSize {
    width: 300.0,
    height: 84.0,
};

/// How often we check whether the primary monitor, its resolution or its scale
/// changed. Windows has no single event for all three, so we simply look.
const WATCH_INTERVAL: Duration = Duration::from_secs(2);

/// Called once at startup: makes the closed island click-through, places it and
/// shows it, then starts watching for monitor changes.
pub fn setup(app: &AppHandle) -> tauri::Result<()> {
    let window = island_window(app)?;
    // Clicks go straight through to the window underneath. Hovering the island
    // will be detected from Rust by polling the cursor (step 3).
    platform::current().set_click_through(&window, true)?;
    place(&window)?;
    window.show()?;
    watch_monitors(app.clone());
    Ok(())
}

/// Puts the island back where it belongs, now.
pub fn reposition(app: &AppHandle) -> tauri::Result<()> {
    place(&island_window(app)?)
}

/// Tray "Mostra/Nascondi".
pub fn toggle(app: &AppHandle) -> tauri::Result<()> {
    let window = island_window(app)?;
    if window.is_visible()? {
        window.hide()
    } else {
        show(app)
    }
}

/// Shows the island (also used when the user launches Wisp a second time).
pub fn show(app: &AppHandle) -> tauri::Result<()> {
    let window = island_window(app)?;
    place(&window)?;
    window.show()
}

// `Result` is either `Ok(value)` or `Err(error)`. The `?` after a call means:
// "if this failed, stop here and hand the error to whoever called us".
fn island_window(app: &AppHandle) -> tauri::Result<WebviewWindow> {
    app.get_webview_window(LABEL)
        .ok_or(tauri::Error::WindowNotFound)
}

/// Sizes the island for the primary monitor's scale and moves it to the spot
/// the platform chooses. Does nothing if it is already right.
fn place(window: &WebviewWindow) -> tauri::Result<()> {
    let Some(monitor) = window.primary_monitor()? else {
        return Ok(()); // no monitor (e.g. during a display switch): try again later
    };
    let size = CLOSED_SIZE.to_physical::<u32>(monitor.scale_factor());
    let area = PhysicalRect {
        position: *monitor.position(),
        size: *monitor.size(),
    };
    let position = platform::current().island_position(area, size);

    // Move first, then resize: moving onto a monitor with a different scale
    // makes Windows resize the window on its own, and we correct it afterwards.
    if window.outer_position()? != position {
        window.set_position(position)?;
    }
    if window.outer_size()? != size {
        window.set_size(size)?;
    }
    Ok(())
}

fn watch_monitors(app: AppHandle) {
    // `move` hands ownership of `app` to the new thread, which then keeps it
    // for as long as it runs (here: until Wisp quits).
    thread::spawn(move || {
        loop {
            thread::sleep(WATCH_INTERVAL);
            if let Err(error) = reposition(&app) {
                eprintln!("could not reposition the island: {error}");
            }
        }
    });
}
