//! API key storage in the OS keychain (macOS Keychain / Windows Credential
//! Manager). The key never goes into SQLite, settings JSON or logs.

const SERVICE: &str = "com.muluo.englishspell";
const ACCOUNT: &str = "ai-api-key";

fn entry() -> Result<keyring::Entry, String> {
    keyring::Entry::new(SERVICE, ACCOUNT).map_err(|e| e.to_string())
}

pub fn get() -> Option<String> {
    entry()
        .ok()?
        .get_password()
        .ok()
        .filter(|k| !k.trim().is_empty())
}

/// Store the key; an empty key deletes it.
pub fn set(key: &str) -> Result<(), String> {
    let entry = entry()?;
    if key.trim().is_empty() {
        return match entry.delete_credential() {
            Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
            Err(e) => Err(e.to_string()),
        };
    }
    entry.set_password(key.trim()).map_err(|e| e.to_string())
}

pub mod commands {
    /// Returns the key for the AI request in the frontend. Never logged.
    #[tauri::command]
    pub fn ai_key_get() -> Option<String> {
        super::get()
    }

    #[tauri::command]
    pub fn ai_key_has() -> bool {
        super::get().is_some()
    }

    #[tauri::command]
    pub fn ai_key_set(key: String) -> Result<(), String> {
        super::set(&key)
    }
}
