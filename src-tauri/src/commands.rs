//! IPC commands the frontend can call. They only forward the user's action to
//! the backend; the backend decides what it means and sends `wisp://state`.

use tauri::AppHandle;
use wisp_core::models::Settings;

use crate::{app_state, island, park};

#[tauri::command]
pub fn set_task(app: AppHandle, text: String) {
    app_state::set_task(&app, &text);
}

#[tauri::command]
pub fn task_done(app: AppHandle) {
    app_state::task_done(&app);
}

#[tauri::command]
pub fn timer_start(app: AppHandle, minutes: u32) {
    app_state::timer_start(&app, minutes);
}

#[tauri::command]
pub fn timer_pause(app: AppHandle) {
    app_state::timer_pause(&app);
}

#[tauri::command]
pub fn timer_resume(app: AppHandle) {
    app_state::timer_resume(&app);
}

#[tauri::command]
pub fn timer_stop(app: AppHandle) {
    app_state::timer_stop(&app);
}

/// While the user types in the island, it must not close under their hands.
#[tauri::command]
pub fn set_editing(app: AppHandle, editing: bool) {
    island::set_keep_open(&app, editing);
}

/// Enter in the park window.
#[tauri::command]
pub fn park_idea(app: AppHandle, text: String) {
    park::save(&app, &text);
}

/// Esc in the park window.
#[tauri::command]
pub fn park_cancel(app: AppHandle) {
    park::cancel(&app);
}

#[tauri::command]
pub fn idea_seen(app: AppHandle, id: u64) {
    app_state::idea_seen(&app, id);
}

#[tauri::command]
pub fn idea_delete(app: AppHandle, id: u64) {
    app_state::idea_delete(&app, id);
}

/// The settings window saves on every change. Returns the settings as stored
/// (values brought into range), or an error code for the shortcut field:
/// "invalid" or "taken".
#[tauri::command]
pub fn update_settings(app: AppHandle, settings: Settings) -> Result<Settings, String> {
    let settings = settings.sanitized();
    let current = app_state::settings(&app);
    if settings.park_shortcut != current.park_shortcut {
        park::change_shortcut(&app, &current.park_shortcut, &settings.park_shortcut)
            .map_err(str::to_string)?;
    }
    app_state::apply_settings(&app, settings.clone());
    Ok(settings)
}
