// In release builds, don't open a console window next to the app on Windows.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod i18n;
mod island;
mod platform;
mod tray;

use tauri::{Manager, WindowEvent};

fn main() {
    tauri::Builder::default()
        // Must be the first plugin: launching Wisp again just shows the running one.
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Err(error) = island::show(app) {
                eprintln!("could not show the island: {error}");
            }
        }))
        .plugin(tauri_plugin_autostart::Builder::new().build())
        .setup(|app| {
            island::setup(app.handle())?;
            tray::create(app.handle())?;
            Ok(())
        })
        .on_window_event(|window, event| {
            // Display scale changed: re-place at once instead of waiting for the watcher.
            if let WindowEvent::ScaleFactorChanged { .. } = event
                && let Err(error) = island::reposition(window.app_handle())
            {
                eprintln!("could not reposition the island: {error}");
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running Wisp");
}
