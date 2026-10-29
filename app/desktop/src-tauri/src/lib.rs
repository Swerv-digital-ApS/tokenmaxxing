//! Tokenmaxxing for the desktop: a menu bar app that keeps your usage in sync (the helper) and shows
//! today's count, with a window for the game itself. The window loads the live game from the server,
//! so it updates with every server deploy; the app only updates for changes to itself.

mod helper;
mod keychain;
mod tray;
mod updates;
mod world;

use serde_json::json;
use std::sync::{Arc, Mutex};
use tauri::ipc::CapabilityBuilder;
use tauri::{Manager, RunEvent, WindowEvent};
use tauri_plugin_autostart::{MacosLauncher, ManagerExt};

/// The server the app talks to, baked in at build time; dev builds use a local one (see build.rs).
pub const SERVER_URL: &str = match option_env!("TOKENMAXXING_SERVER_URL") {
    Some(url) => url,
    None => "http://localhost:8787",
};

/// What the menu shows, kept so it can be rebuilt when anything changes.
#[derive(Default)]
pub struct Ui {
    pub state: helper::State,
    pub update: updates::Status,
    /// Opened by hand (not at login), or before the helper was up: the game opens once the account is known.
    pub open_on_ready: bool,
    /// "Link a computer…" put its line on the clipboard; its code works until then.
    pub link_copied_until: Option<std::time::Instant>,
}

/// The login item passes this, so starting at login stays in the menu bar.
const AT_LOGIN: &str = "--at-login";

pub type Shared = Mutex<Ui>;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // First: a second launch (from the Dock, Spotlight or a login item) opens the world in the
        // running app instead of starting another.
        .plugin(tauri_plugin_single_instance::init(|app, _, _| {
            world::open(app)
        }))
        .plugin(
            tauri_plugin_log::Builder::new()
                .level(log::LevelFilter::Info)
                .targets([
                    tauri_plugin_log::Target::new(tauri_plugin_log::TargetKind::LogDir {
                        file_name: Some("tokenmaxxing".into()),
                    }),
                    tauri_plugin_log::Target::new(tauri_plugin_log::TargetKind::Stdout),
                ])
                .build(),
        )
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .plugin(tauri_plugin_autostart::init(
            MacosLauncher::LaunchAgent,
            Some(vec![AT_LOGIN]),
        ))
        .plugin(tauri_plugin_updater::Builder::new().build())
        .manage(Shared::default())
        .invoke_handler(tauri::generate_handler![
            world::enter_world,
            world::open_link,
            world::link_computer,
            updates::update_status,
            updates::install_update
        ])
        .setup(|app| {
            // Menu bar only until a window opens (Info.plist has LSUIElement too).
            #[cfg(target_os = "macos")]
            app.set_activation_policy(tauri::ActivationPolicy::Accessory);
            app.state::<Shared>().lock().unwrap().open_on_ready =
                !std::env::args().any(|arg| arg == AT_LOGIN);
            // Rewrites a login item made before it passed AT_LOGIN, which would open the game.
            let login = app.autolaunch();
            if login.is_enabled().unwrap_or(false) {
                let _ = login.enable();
            }
            tray::build(app.handle())?;
            // The game window (the server's page) may ask about app updates and start one, sign itself
            // in when it has no session, open web links in the browser, and get a line that links
            // another computer, and nothing else.
            app.add_capability(
                CapabilityBuilder::new("world")
                    .remote(format!("{SERVER_URL}/*"))
                    .local(false)
                    .window(world::WORLD)
                    .permission("core:event:allow-listen")
                    .permission("core:event:allow-unlisten")
                    .permission("allow-update-status")
                    .permission("allow-install-update")
                    .permission("allow-enter-world")
                    .permission("allow-open-link")
                    .permission("allow-link-computer"),
            )?;
            let events = app.handle().clone();
            let helper = helper::Helper::start(
                move |message| on_helper(&events, message),
                || json!({ "cmd": "init", "token": keychain::get(), "serverUrl": SERVER_URL }),
            );
            app.manage(helper);
            updates::watch(app.handle().clone());
            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::Destroyed = event {
                world::closed(window.app_handle());
                updates::closed(window.app_handle());
            }
        })
        .build(tauri::generate_context!())
        .expect("error while building the app")
        .run(|app, event| match event {
            // Closing the last window keeps the menu bar app running; Quit (an explicit exit code) doesn't.
            RunEvent::ExitRequested {
                api, code: None, ..
            } => api.prevent_exit(),
            RunEvent::Exit => app.state::<Arc<helper::Helper>>().stop(),
            // Opened again (Finder, Dock, Spotlight) while running: the game, as on first launch.
            #[cfg(target_os = "macos")]
            RunEvent::Reopen { .. } => world::open(app),
            _ => {}
        });
}

fn on_helper(app: &tauri::AppHandle, message: helper::Message) {
    match message {
        helper::Message::State(state) => {
            let phase = state.phase.clone();
            app.state::<Shared>().lock().unwrap().state = state;
            tray::refresh(app);
            if phase == "onboarding" || phase == "ready" {
                let by_hand =
                    std::mem::take(&mut app.state::<Shared>().lock().unwrap().open_on_ready);
                // No account yet: the game window asks for a name.
                if phase == "onboarding" || updates::reopen(app) || by_hand {
                    world::open(app);
                }
            }
        }
        helper::Message::Token(Some(token)) => keychain::set(&token),
        helper::Message::Token(None) => keychain::delete(),
        helper::Message::Reply { .. } => {}
    }
}
