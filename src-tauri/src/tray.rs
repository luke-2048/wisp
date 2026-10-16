//! The tray icon and its menu.

use tauri::{
    AppHandle,
    menu::{CheckMenuItem, Menu, MenuEvent, MenuItem, PredefinedMenuItem},
    tray::TrayIconBuilder,
};
use tauri_plugin_autostart::ManagerExt;

use crate::{i18n, island};

// Menu item ids: they tell us which item was clicked.
const SHOW_HIDE: &str = "show_hide";
const SETTINGS: &str = "settings";
const AUTOSTART: &str = "autostart";
const QUIT: &str = "quit";

pub fn create(app: &AppHandle) -> tauri::Result<()> {
    let text = i18n::italian().tray;
    let autostart_on = app.autolaunch().is_enabled().unwrap_or(false);

    let show_hide = MenuItem::with_id(app, SHOW_HIDE, &text.show_hide, true, None::<&str>)?;
    // Disabled until the settings window exists (step 6).
    let settings = MenuItem::with_id(app, SETTINGS, &text.settings, false, None::<&str>)?;
    let autostart = CheckMenuItem::with_id(
        app,
        AUTOSTART,
        &text.autostart,
        true,
        autostart_on,
        None::<&str>,
    )?;
    let quit = MenuItem::with_id(app, QUIT, &text.quit, true, None::<&str>)?;
    let separator = PredefinedMenuItem::separator(app)?;
    let menu = Menu::with_items(app, &[&show_hide, &settings, &autostart, &separator, &quit])?;

    let mut tray = TrayIconBuilder::with_id("wisp")
        .tooltip(&text.tooltip)
        .menu(&menu)
        .show_menu_on_left_click(true)
        .on_menu_event(move |app, event| on_menu_event(app, &event, &autostart));
    if let Some(icon) = app.default_window_icon() {
        tray = tray.icon(icon.clone());
    }
    tray.build(app)?;
    Ok(())
}

fn on_menu_event(app: &AppHandle, event: &MenuEvent, autostart: &CheckMenuItem<tauri::Wry>) {
    let result = match event.id().as_ref() {
        SHOW_HIDE => island::toggle(app),
        AUTOSTART => {
            toggle_autostart(app, autostart);
            Ok(())
        }
        QUIT => {
            app.exit(0);
            Ok(())
        }
        _ => Ok(()),
    };
    if let Err(error) = result {
        eprintln!("tray action failed: {error}");
    }
}

/// The checkbox flips itself when clicked; we make Windows match it, and put
/// the checkbox back if Windows refuses.
fn toggle_autostart(app: &AppHandle, item: &CheckMenuItem<tauri::Wry>) {
    let wanted = item.is_checked().unwrap_or(false);
    let manager = app.autolaunch();
    let result = if wanted {
        manager.enable()
    } else {
        manager.disable()
    };
    if let Err(error) = result {
        eprintln!("could not change autostart: {error}");
        let actual = manager.is_enabled().unwrap_or(false);
        let _ = item.set_checked(actual);
    }
}
