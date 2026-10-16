//! The island window: where it sits, and opening it when the cursor hovers it.

use std::{
    sync::Mutex,
    thread,
    time::{Duration, Instant},
};

use serde::Serialize;
use tauri::{
    AppHandle, Emitter, LogicalSize, Manager, PhysicalPosition, PhysicalRect, WebviewWindow,
};
use wisp_core::hover::{HoverAction, HoverTracker};

use crate::platform::{self, Platform};

/// Window label, as declared in `tauri.conf.json`.
const LABEL: &str = "island";

/// Closed: just the black bar. Sizes are logical pixels, i.e. before
/// Windows' display scaling.
const CLOSED_SIZE: LogicalSize<f64> = LogicalSize {
    width: 240.0,
    height: 30.0,
};

/// Open: the 540x236 panel plus room for its soft shadow (20 px on each side,
/// 30 px below). Must match `.island.open` in `src/island/island.css`.
const OPEN_SIZE: LogicalSize<f64> = LogicalSize {
    width: 580.0,
    height: 266.0,
};
const PANEL_MARGIN_X: f64 = 20.0;
const PANEL_HEIGHT: f64 = 236.0;

/// How often we look at the cursor.
const POLL_INTERVAL: Duration = Duration::from_millis(50);

/// Every this many polls (2 s) we also check whether the primary monitor, its
/// resolution or its scale changed. Windows has no single event for all three.
const POLLS_PER_MONITOR_CHECK: u32 = 40;

/// Event telling the frontend to play the open/close animation.
const ISLAND_EVENT: &str = "wisp://island";

#[derive(Clone, Serialize)]
struct IslandEvent {
    open: bool,
}

/// Shared between the polling thread and the tray. A `Mutex` is a lock: only
/// one thread at a time can get inside and read or change the tracker.
#[derive(Default)]
pub struct IslandState(Mutex<HoverTracker>);

/// Called once at startup: makes the closed island click-through, places it and
/// shows it, then starts following the cursor and the monitors.
pub fn setup(app: &AppHandle) -> tauri::Result<()> {
    let window = island_window(app)?;
    // Closed, clicks go straight through to the window underneath.
    platform::current().set_click_through(&window, true)?;
    place(&window, is_expanded(app))?;
    window.show()?;
    start_polling(app.clone());
    Ok(())
}

/// Puts the island back where it belongs, now.
pub fn reposition(app: &AppHandle) -> tauri::Result<()> {
    place(&island_window(app)?, is_expanded(app))
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
    place(&window, is_expanded(app))?;
    window.show()
}

// `Result` is either `Ok(value)` or `Err(error)`. The `?` after a call means:
// "if this failed, stop here and hand the error to whoever called us".
fn island_window(app: &AppHandle) -> tauri::Result<WebviewWindow> {
    app.get_webview_window(LABEL)
        .ok_or(tauri::Error::WindowNotFound)
}

fn tracker(app: &AppHandle) -> std::sync::MutexGuard<'_, HoverTracker> {
    // `lock()` waits for the lock; it only fails if another thread panicked
    // while holding it, and then the tracker is still usable.
    app.state::<IslandState>()
        .inner()
        .0
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner())
}

fn is_expanded(app: &AppHandle) -> bool {
    tracker(app).is_expanded()
}

/// Sizes the island for the primary monitor's scale and moves it to the spot
/// the platform chooses. Does nothing if it is already right.
fn place(window: &WebviewWindow, expanded: bool) -> tauri::Result<()> {
    let Some(monitor) = window.primary_monitor()? else {
        return Ok(()); // no monitor (e.g. during a display switch): try again later
    };
    let logical = if expanded { OPEN_SIZE } else { CLOSED_SIZE };
    let size = logical.to_physical::<u32>(monitor.scale_factor());
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

fn start_polling(app: AppHandle) {
    // `move` hands ownership of `app` to the new thread, which then keeps it
    // for as long as it runs (here: until Wisp quits).
    thread::spawn(move || {
        let mut polls: u32 = 0;
        loop {
            thread::sleep(POLL_INTERVAL);
            polls = polls.wrapping_add(1);
            if let Err(error) = follow_cursor(&app) {
                eprintln!("could not follow the cursor: {error}");
            }
            if polls.is_multiple_of(POLLS_PER_MONITOR_CHECK)
                && let Err(error) = reposition(&app)
            {
                eprintln!("could not reposition the island: {error}");
            }
        }
    });
}

fn follow_cursor(app: &AppHandle) -> tauri::Result<()> {
    let window = island_window(app)?;
    if !window.is_visible()? {
        return Ok(());
    }
    let cursor = app.cursor_position()?;
    let scale = window.scale_factor()?;
    let origin = window.outer_position()?;
    let size = window.outer_size()?;

    // The braces limit how long we hold the lock: it is released at `}`,
    // before we touch the window.
    let action = {
        let mut tracker = tracker(app);
        let zone = hover_zone(origin, size, scale, tracker.is_expanded());
        tracker.update(zone.contains(cursor), Instant::now())
    };

    match action {
        Some(HoverAction::Expand) => {
            place(&window, true)?;
            platform::current().set_click_through(&window, false)?;
            app.emit(ISLAND_EVENT, IslandEvent { open: true })?;
        }
        Some(HoverAction::Collapse) => {
            app.emit(ISLAND_EVENT, IslandEvent { open: false })?;
        }
        Some(HoverAction::Shrink) => {
            platform::current().set_click_through(&window, true)?;
            place(&window, false)?;
        }
        None => {}
    }
    Ok(())
}

/// The area that counts as "over the island", in physical pixels: the whole
/// window when closed, only the black panel (not its shadow) when open.
fn hover_zone(
    origin: PhysicalPosition<i32>,
    size: tauri::PhysicalSize<u32>,
    scale: f64,
    expanded: bool,
) -> Zone {
    let (left, top) = (f64::from(origin.x), f64::from(origin.y));
    if expanded {
        let margin = PANEL_MARGIN_X * scale;
        Zone {
            left: left + margin,
            top,
            right: left + f64::from(size.width) - margin,
            bottom: top + PANEL_HEIGHT * scale,
        }
    } else {
        Zone {
            left,
            top,
            right: left + f64::from(size.width),
            bottom: top + f64::from(size.height),
        }
    }
}

struct Zone {
    left: f64,
    top: f64,
    right: f64,
    bottom: f64,
}

impl Zone {
    fn contains(&self, point: PhysicalPosition<f64>) -> bool {
        (self.left..self.right).contains(&point.x) && (self.top..self.bottom).contains(&point.y)
    }
}
