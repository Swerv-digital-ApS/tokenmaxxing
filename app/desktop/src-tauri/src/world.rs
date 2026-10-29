//! The game window: the server's page at `/play`. With no session, the page signs itself in through
//! the app (`enter_world`), or asks for a name first when there's no account yet. The app shows in the
//! Dock only while it's open.

use crate::helper::Helper;
use crate::{Shared, SERVER_URL};
use serde_json::json;
use std::sync::Arc;
use tauri::{AppHandle, Manager, Url, WebviewUrl, WebviewWindowBuilder};
use tauri_plugin_autostart::ManagerExt;
use tauri_plugin_opener::OpenerExt;

pub const WORLD: &str = "world";

/// Opens the game, or brings it to the front. Until the helper knows whether there's an account, it
/// waits (see `open_on_ready`): the page couldn't tell a new player from a known one yet.
pub fn open(app: &AppHandle) {
    if focus(app, WORLD) {
        return;
    }
    {
        let shared = app.state::<Shared>();
        let mut ui = shared.lock().unwrap();
        if !matches!(ui.state.phase.as_str(), "ready" | "onboarding") {
            ui.open_on_ready = true;
            return;
        }
    }
    if let Err(e) = world_window(app) {
        log::error!("could not open the world: {e}");
    }
}

fn world_window(app: &AppHandle) -> Result<(), String> {
    let url: Url = format!("{SERVER_URL}/play")
        .parse()
        .map_err(|e| format!("bad server url {SERVER_URL}: {e}"))?;
    let origin = url.origin();
    let links = app.clone();
    let new_windows = app.clone();
    WebviewWindowBuilder::new(app, WORLD, WebviewUrl::External(url))
        .title("Tokenmaxxing")
        .inner_size(1280.0, 800.0)
        .min_inner_size(720.0, 480.0)
        // The window stays on the game; any other link (a company's website) opens in the browser.
        .on_navigation(move |to| {
            if to.origin() == origin {
                return true;
            }
            if let Err(e) = links.opener().open_url(to.as_str(), None::<&str>) {
                log::warn!("could not open {to}: {e}");
            }
            false
        })
        // A link that asks for a new window (a company's website): the browser, not another app window.
        .on_new_window(move |to, _| {
            if let Err(e) = new_windows.opener().open_url(to.as_str(), None::<&str>) {
                log::warn!("could not open {to}: {e}");
            }
            tauri::webview::NewWindowResponse::Deny
        })
        .build()
        .map_err(|e| e.to_string())?;
    shown(app);
    Ok(())
}

/// From the game page when it has no session: a single-use login code for it, after signing up if it
/// was given a name. Errors are the helper's codes; `signed_out` means there's no account yet.
#[tauri::command]
pub async fn enter_world(app: AppHandle, name: Option<String>) -> Result<String, String> {
    let helper = app.state::<Arc<Helper>>().inner().clone();
    let new = name.is_some();
    let result = tauri::async_runtime::spawn_blocking(move || {
        if let Some(name) = name {
            helper.call(json!({ "cmd": "signUp", "name": name }))?;
        }
        helper.call(json!({ "cmd": "openWorld" }))
    })
    .await
    .map_err(|_| "internal".to_string())??;
    // A new account starts at login, as the menu bar app always did.
    if new {
        if let Err(e) = app.autolaunch().enable() {
            log::warn!("could not turn on launch at login: {e}");
        }
    }
    result["code"]
        .as_str()
        .map(String::from)
        .ok_or_else(|| "internal".into())
}

/// From the game page: the line to run on another computer to add its usage to this account (it
/// installs the CLI there, with a link code good for 10 minutes).
#[tauri::command]
pub async fn link_computer(app: AppHandle) -> Result<String, String> {
    let helper = app.state::<Arc<Helper>>().inner().clone();
    let result =
        tauri::async_runtime::spawn_blocking(move || helper.call(json!({ "cmd": "linkComputer" })))
            .await
            .map_err(|_| "internal".to_string())??;
    result["command"]
        .as_str()
        .map(String::from)
        .ok_or_else(|| "internal".into())
}

/// From the game page: a link out of the game (a company's website) opens in the browser. The page
/// asks for this itself, as WebKit doesn't reliably hand `target="_blank"` links to the handlers above.
#[tauri::command]
pub fn open_link(app: AppHandle, url: String) -> Result<(), String> {
    let url: Url = url.parse().map_err(|_| "bad url".to_string())?;
    if !matches!(url.scheme(), "http" | "https") {
        return Err("only web links open".into());
    }
    app.opener()
        .open_url(url.as_str(), None::<&str>)
        .map_err(|e| e.to_string())
}

/// A window closed: back to the menu bar only once none are left.
pub fn closed(_app: &AppHandle) {
    #[cfg(target_os = "macos")]
    if _app.webview_windows().is_empty() {
        let _ = _app.set_activation_policy(tauri::ActivationPolicy::Accessory);
    }
}

fn shown(_app: &AppHandle) {
    #[cfg(target_os = "macos")]
    let _ = _app.set_activation_policy(tauri::ActivationPolicy::Regular);
    #[cfg(target_os = "macos")]
    let _ = _app.show();
}

/// Brings an open window to the front; false if it isn't open.
fn focus(app: &AppHandle, label: &str) -> bool {
    let Some(window) = app.get_webview_window(label) else {
        return false;
    };
    let _ = window.unminimize();
    let _ = window.show();
    let _ = window.set_focus();
    shown(app);
    true
}
