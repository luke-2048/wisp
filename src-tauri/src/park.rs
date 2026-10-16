//! The park window: a small field in the middle of the screen, opened with a
//! global shortcut (Ctrl+Shift+Space by default) from any app, to write an idea down and get straight back
//! to the window you were working in.

use std::sync::{Mutex, MutexGuard};

use tauri::{AppHandle, Emitter, LogicalSize, Manager, PhysicalPosition, WebviewWindow};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutEvent, ShortcutState};

use crate::{
    app_state,
    platform::{self, ForeignWindow, Platform},
};

/// Window label, as declared in `tauri.conf.json`.
pub const LABEL: &str = "park";

/// The field plus room for its shadow. Must match `src/park/park.css`.
const SIZE: LogicalSize<f64> = LogicalSize {
    width: 520.0,
    height: 100.0,
};

/// Tells the park page to empty the field and focus it.
const OPEN_EVENT: &str = "wisp://park";

/// The window the user was in before pressing the shortcut.
#[derive(Default)]
pub struct ParkState(Mutex<Option<ForeignWindow>>);

fn previous(app: &AppHandle) -> MutexGuard<'_, Option<ForeignWindow>> {
    app.state::<ParkState>()
        .inner()
        .0
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner())
}

/// Registers the shortcut from the settings (Ctrl+Shift+Space by default).
/// If another app already owns it, Wisp still starts; the user can pick
/// another one in the settings.
pub fn register_shortcut(app: &AppHandle) {
    let shortcut = app_state::settings(app).park_shortcut;
    if let Err(error) = app.global_shortcut().register(shortcut.as_str()) {
        eprintln!("could not register {shortcut}: {error}");
    }
}

/// Swaps the shortcut. On failure the old one stays active and the error code
/// ("invalid" or "taken") tells the settings window what to say.
pub fn change_shortcut(app: &AppHandle, old: &str, new: &str) -> Result<(), &'static str> {
    let new: Shortcut = new.parse().map_err(|_| "invalid")?;
    let shortcuts = app.global_shortcut();
    let _ = shortcuts.unregister(old);
    if shortcuts.register(new).is_err() {
        let _ = shortcuts.register(old);
        return Err("taken");
    }
    Ok(())
}

pub fn on_shortcut(app: &AppHandle, event: ShortcutEvent) {
    if event.state == ShortcutState::Pressed
        && let Err(error) = open(app)
    {
        eprintln!("could not open the park window: {error}");
    }
}

fn open(app: &AppHandle) -> tauri::Result<()> {
    let window = park_window(app)?;
    if !window.is_visible()? {
        *previous(app) = platform::current().foreground_window();
        place_centred(&window)?;
        window.show()?;
    }
    window.set_focus()?;
    app.emit_to(LABEL, OPEN_EVENT, ())
}

/// Enter: keep the idea, go back to work.
pub fn save(app: &AppHandle, text: &str) {
    app_state::park_idea(app, text);
    close(app, true);
}

/// Esc: nothing kept, go back to work.
pub fn cancel(app: &AppHandle) {
    close(app, true);
}

/// The user clicked another window: they chose where to go, just hide.
pub fn dismiss(app: &AppHandle) {
    close(app, false);
}

fn close(app: &AppHandle, give_focus_back: bool) {
    // `take()` empties the memory: each remembered window is used once.
    let remembered = previous(app).take();
    // Focus first, then hide: Windows lets us pass the focus on only while
    // our window still has it.
    if give_focus_back && let Some(window) = remembered {
        platform::current().focus_window(window);
    }
    if let Err(error) = park_window(app).and_then(|window| window.hide()) {
        eprintln!("could not hide the park window: {error}");
    }
}

fn park_window(app: &AppHandle) -> tauri::Result<WebviewWindow> {
    app.get_webview_window(LABEL)
        .ok_or(tauri::Error::WindowNotFound)
}

/// In the middle of the primary monitor, sized for its display scale.
fn place_centred(window: &WebviewWindow) -> tauri::Result<()> {
    let Some(monitor) = window.primary_monitor()? else {
        return Ok(());
    };
    let size = SIZE.to_physical::<u32>(monitor.scale_factor());
    let area = monitor.size();
    let origin = monitor.position();
    let x = origin.x + (area.width as i32 - size.width as i32) / 2;
    let y = origin.y + (area.height as i32 - size.height as i32) / 2;
    window.set_size(size)?;
    window.set_position(PhysicalPosition::new(x, y))
}
