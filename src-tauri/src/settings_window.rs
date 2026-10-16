//! The settings window, opened from the tray. It is created hidden at startup
//! (`tauri.conf.json`) and only shown or hidden afterwards, so it opens instantly.

use tauri::{AppHandle, Manager, Window};

/// Window label, as declared in `tauri.conf.json`.
pub const LABEL: &str = "settings";

/// Tray "Impostazioni".
pub fn open(app: &AppHandle) -> tauri::Result<()> {
    let window = app
        .get_webview_window(LABEL)
        .ok_or(tauri::Error::WindowNotFound)?;
    window.unminimize()?;
    window.show()?;
    window.set_focus()
}

/// The X button only hides the window: closing it would destroy it, and the
/// tray could not open it again.
pub fn hide_instead_of_closing(window: &Window, api: &tauri::CloseRequestApi) {
    api.prevent_close();
    if let Err(error) = window.hide() {
        eprintln!("could not hide the settings window: {error}");
    }
}
