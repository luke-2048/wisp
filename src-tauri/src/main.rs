// In release builds, don't open a console window next to the app on Windows.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod app_state;
mod commands;
mod db;
mod i18n;
mod island;
mod park;
mod platform;
mod settings_window;
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
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(|app, _shortcut, event| park::on_shortcut(app, event))
                .build(),
        )
        .manage(island::IslandState::default())
        .manage(app_state::AppState::default())
        .manage(park::ParkState::default())
        .invoke_handler(tauri::generate_handler![
            app_state::current_snapshot,
            commands::set_task,
            commands::task_done,
            commands::timer_start,
            commands::timer_pause,
            commands::timer_resume,
            commands::timer_stop,
            commands::set_editing,
            commands::park_idea,
            commands::park_cancel,
            commands::idea_seen,
            commands::idea_delete,
            commands::update_settings,
        ])
        .setup(|app| {
            // First: everything else reads the saved settings.
            app_state::load(app.handle());
            island::setup(app.handle())?;
            tray::create(app.handle())?;
            park::register_shortcut(app.handle());
            app_state::start_ticking(app.handle().clone());
            Ok(())
        })
        .on_window_event(|window, event| match event {
            // Display scale changed: re-place at once instead of waiting for the watcher.
            WindowEvent::ScaleFactorChanged { .. } => {
                if let Err(error) = island::reposition(window.app_handle()) {
                    eprintln!("could not reposition the island: {error}");
                }
            }
            // The user clicked away from the park window: hide it.
            WindowEvent::Focused(false) if window.label() == park::LABEL => {
                park::dismiss(window.app_handle());
            }
            WindowEvent::CloseRequested { api, .. } if window.label() == settings_window::LABEL => {
                settings_window::hide_instead_of_closing(window, api);
            }
            _ => {}
        })
        .run(tauri::generate_context!())
        .expect("error while running Wisp");
}
