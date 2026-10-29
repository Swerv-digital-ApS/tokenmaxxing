//! Self-update: the app checks this repo's latest GitHub release (latest.json) on launch and every
//! hour. A new version installs itself (and the app restarts) as soon as no window is open. While the
//! game is open it waits, shown in the game and in the menu, until you click it there or close the
//! window. Downloads are verified against the public key in tauri.conf.json before they're installed.
//! Dev builds never check.

use crate::{tray, world, Shared};
use serde::Serialize;
use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_updater::{Update, UpdaterExt};

// Preview installers have no published, signed Linux/Windows update feed yet.
pub const SUPPORTED: bool = cfg!(target_os = "macos");

const EVERY: Duration = Duration::from_secs(60 * 60);
/// Left behind by an update installed with the game open, so the game opens again after the restart.
const REOPEN: &str = "reopen-world";

#[derive(Default)]
pub enum Status {
    #[default]
    Unknown,
    Checking,
    Current,
    Available(Box<Update>),
    Installing,
}

/// What the game shows (see web/src/hud/AppUpdate.tsx): sent as `app-update` whenever it changes.
#[derive(Clone, Serialize)]
pub struct Shown {
    current: String,
    available: Option<String>,
    installing: bool,
}

pub fn watch(app: AppHandle) {
    if cfg!(debug_assertions) || !SUPPORTED {
        return;
    }
    std::thread::spawn(move || loop {
        tauri::async_runtime::block_on(check(&app));
        std::thread::sleep(EVERY);
    });
}

/// "Check for updates…" checks now; "Update to X.Y.Z…" installs it and restarts.
pub fn from_menu(app: &AppHandle) {
    if !SUPPORTED {
        return;
    }
    if !install_now(app) {
        let app = app.clone();
        tauri::async_runtime::spawn(async move { check(&app).await });
    }
}

/// A window closed: with none left, a waiting update installs now.
pub fn closed(app: &AppHandle) {
    if app.webview_windows().is_empty() {
        install_now(app);
    }
}

/// True after an update installed from the game restarted the app: open the game again.
pub fn reopen(app: &AppHandle) -> bool {
    let Ok(dir) = app.path().app_data_dir() else {
        return false;
    };
    std::fs::remove_file(dir.join(REOPEN)).is_ok()
}

/// The game asks what to show when it loads; changes arrive as `app-update` events.
#[tauri::command]
pub fn update_status(app: AppHandle) -> Shown {
    shown(&app)
}

/// The game's "Update" button.
#[tauri::command]
pub fn install_update(app: AppHandle) {
    install_now(&app);
}

/// Installs the waiting update, if there is one.
fn install_now(app: &AppHandle) -> bool {
    // Its own statement: in a `match` head the lock would be held through the arms, and the arm
    // below locking again would wait on itself forever.
    let taken = std::mem::take(&mut app.state::<Shared>().lock().unwrap().update);
    let found = match taken {
        Status::Available(update) => update,
        other => {
            app.state::<Shared>().lock().unwrap().update = other;
            return false;
        }
    };
    let app = app.clone();
    tauri::async_runtime::spawn(async move { install(&app, *found).await });
    true
}

async fn check(app: &AppHandle) {
    set(app, Status::Checking);
    let status = match app.updater().map(|u| async move { u.check().await }) {
        Ok(checking) => match checking.await {
            Ok(Some(update)) => Status::Available(Box::new(update)),
            Ok(None) => Status::Current,
            Err(e) => {
                log::warn!("update check failed: {e}");
                Status::Unknown
            }
        },
        Err(e) => {
            log::warn!("no updater: {e}");
            Status::Unknown
        }
    };
    set(app, status);
    // Nobody is looking: update right away.
    closed(app);
}

async fn install(app: &AppHandle, update: Update) {
    let version = update.version.clone();
    set(app, Status::Installing);
    match update.download_and_install(|_, _| {}, || {}).await {
        Ok(()) => {
            log::info!("updated to {version}; restarting");
            if app.get_webview_window(world::WORLD).is_some() {
                if let Ok(dir) = app.path().app_data_dir() {
                    let _ = std::fs::create_dir_all(&dir);
                    let _ = std::fs::write(dir.join(REOPEN), "");
                }
            }
            app.restart();
        }
        Err(e) => {
            log::error!("could not install {version}: {e}");
            set(app, Status::Unknown);
        }
    }
}

fn shown(app: &AppHandle) -> Shown {
    let ui = app.state::<Shared>();
    let ui = ui.lock().unwrap();
    Shown {
        current: app.package_info().version.to_string(),
        available: match &ui.update {
            Status::Available(update) => Some(update.version.clone()),
            _ => None,
        },
        installing: matches!(ui.update, Status::Installing),
    }
}

fn set(app: &AppHandle, status: Status) {
    app.state::<Shared>().lock().unwrap().update = status;
    tray::refresh(app);
    let _ = app.emit_to(world::WORLD, "app-update", shown(app));
}
