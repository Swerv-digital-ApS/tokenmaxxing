//! Device tokens in the platform credential store. macOS keeps the original entry so upgrades
//! stay signed in; Linux uses Secret Service and Windows uses Credential Manager. Dev is isolated.

const ACCOUNT: &str = "api-token";

const SERVICE: &str = if cfg!(debug_assertions) {
    "dk.hanskristoffer.tokenmaxxing.dev"
} else {
    "dk.hanskristoffer.tokenmaxxing"
};

#[cfg(target_os = "macos")]
mod platform {
    use super::{ACCOUNT, SERVICE};
    use security_framework::passwords::{
        delete_generic_password, get_generic_password, set_generic_password,
    };

    pub fn get() -> Option<String> {
        get_generic_password(SERVICE, ACCOUNT)
            .ok()
            .and_then(|bytes| String::from_utf8(bytes).ok())
    }

    pub fn set(token: &str) {
        if let Err(e) = set_generic_password(SERVICE, ACCOUNT, token.as_bytes()) {
            log::error!("could not save the token: {e}");
        }
    }

    pub fn delete() {
        let _ = delete_generic_password(SERVICE, ACCOUNT);
    }
}

#[cfg(any(target_os = "linux", target_os = "windows"))]
mod platform {
    use super::{ACCOUNT, SERVICE};

    pub fn get() -> Option<String> {
        match keyring::Entry::new(SERVICE, ACCOUNT).and_then(|entry| entry.get_password()) {
            Ok(token) => Some(token),
            Err(keyring::Error::NoEntry) => None,
            Err(e) => {
                log::error!("could not read the token from the credential store: {e}");
                None
            }
        }
    }

    pub fn set(token: &str) {
        if let Err(e) =
            keyring::Entry::new(SERVICE, ACCOUNT).and_then(|entry| entry.set_password(token))
        {
            log::error!("could not save the token to the credential store: {e}");
        }
    }

    pub fn delete() {
        if let Err(e) =
            keyring::Entry::new(SERVICE, ACCOUNT).and_then(|entry| entry.delete_credential())
        {
            if !matches!(e, keyring::Error::NoEntry) {
                log::error!("could not delete the token from the credential store: {e}");
            }
        }
    }
}

pub use platform::{delete, get, set};
