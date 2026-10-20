//! The tray icon and its menu.

use tauri::{
    AppHandle, Wry,
    menu::{CheckMenuItem, IsMenuItem, Menu, MenuEvent, MenuItem, PredefinedMenuItem},
    tray::TrayIconBuilder,
};
use tauri_plugin_autostart::ManagerExt;

use crate::{i18n, island, settings_window};

// Menu item ids: they tell us which item was clicked.
const SHOW_HIDE: &str = "show_hide";
const SETTINGS: &str = "settings";
const AUTOSTART: &str = "autostart";
const QUIT: &str = "quit";

pub fn create(app: &AppHandle) -> tauri::Result<()> {
    let text = i18n::english();
    let autostart_on = app.autolaunch().is_enabled().unwrap_or(false);

    let show_hide = MenuItem::with_id(app, SHOW_HIDE, &text.tray.show_hide, true, None::<&str>)?;
    let settings = MenuItem::with_id(app, SETTINGS, &text.tray.settings, true, None::<&str>)?;
    let autostart = CheckMenuItem::with_id(
        app,
        AUTOSTART,
        &text.tray.autostart,
        true,
        autostart_on,
        None::<&str>,
    )?;
    let quit = MenuItem::with_id(app, QUIT, &text.tray.quit, true, None::<&str>)?;
    let separator = PredefinedMenuItem::separator(app)?;

    // `Vec<&dyn IsMenuItem<Wry>>` is a list of "anything that can be a menu
    // item": `dyn` lets different item types sit in the same list.
    let mut items: Vec<&dyn IsMenuItem<Wry>> = vec![&show_hide, &settings, &autostart];

    // Debug builds only (`npm run tauri dev`): force any of the six states.
    #[cfg(debug_assertions)]
    let debug_menu = debug::menu(app, &text)?;
    #[cfg(debug_assertions)]
    items.push(&debug_menu.submenu);

    items.push(&separator);
    items.push(&quit);
    let menu = Menu::with_items(app, &items)?;

    let mut tray = TrayIconBuilder::with_id("wisp")
        .tooltip(&text.tray.tooltip)
        .menu(&menu)
        .show_menu_on_left_click(true)
        .on_menu_event(move |app, event| {
            #[cfg(debug_assertions)]
            if debug_menu.handle(app, &event) {
                return;
            }
            on_menu_event(app, &event, &autostart);
        });
    if let Some(icon) = app.default_window_icon() {
        tray = tray.icon(icon.clone());
    }
    tray.build(app)?;
    Ok(())
}

fn on_menu_event(app: &AppHandle, event: &MenuEvent, autostart: &CheckMenuItem<Wry>) {
    let result = match event.id().as_ref() {
        SHOW_HIDE => island::toggle(app),
        SETTINGS => settings_window::open(app),
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
fn toggle_autostart(app: &AppHandle, item: &CheckMenuItem<Wry>) {
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

/// "Debug: stato di Wisp" submenu. A forced state stays until "Automatico".
#[cfg(debug_assertions)]
mod debug {
    use tauri::{
        AppHandle, Wry,
        menu::{CheckMenuItem, MenuEvent, PredefinedMenuItem, Submenu},
    };
    use wisp_core::models::WispState;

    use crate::{app_state, i18n::Strings};

    const PREFIX: &str = "debug:";
    const AUTOMATIC: &str = "debug:automatic";

    pub struct DebugMenu {
        pub submenu: Submenu<Wry>,
        /// "Automatico" first, then one item per state.
        choices: Vec<CheckMenuItem<Wry>>,
    }

    pub fn menu(app: &AppHandle, text: &Strings) -> tauri::Result<DebugMenu> {
        let automatic = CheckMenuItem::with_id(
            app,
            AUTOMATIC,
            &text.tray.automatic,
            true,
            true,
            None::<&str>,
        )?;
        let mut choices = vec![automatic];
        for state in WispState::ALL {
            let id = format!("{PREFIX}{}", state.id());
            let name = text.state_name(state);
            choices.push(CheckMenuItem::with_id(
                app,
                id,
                name,
                true,
                false,
                None::<&str>,
            )?);
        }

        let submenu = Submenu::with_id(app, "debug", &text.tray.debug, true)?;
        submenu.append(&choices[0])?;
        submenu.append(&PredefinedMenuItem::separator(app)?)?;
        for choice in &choices[1..] {
            submenu.append(choice)?;
        }
        Ok(DebugMenu { submenu, choices })
    }

    impl DebugMenu {
        /// Returns true if the click was one of ours.
        pub fn handle(&self, app: &AppHandle, event: &MenuEvent) -> bool {
            let id = event.id().as_ref();
            let Some(name) = id.strip_prefix(PREFIX) else {
                return false;
            };
            let forced = WispState::from_id(name); // "automatic" gives None
            app_state::force(app, forced);
            // Behave like radio buttons: only the clicked item stays checked.
            for choice in &self.choices {
                let _ = choice.set_checked(choice.id().as_ref() == id);
            }
            true
        }
    }
}
