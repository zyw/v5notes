use std::path::PathBuf;
use std::process::Command;

use tauri::Manager;
use tauri_plugin_fs::FsExt;

#[tauri::command]
fn allow_vault_directory(app: tauri::AppHandle, path: String) -> Result<(), String> {
    let root = PathBuf::from(&path);
    if !root.is_absolute() {
        return Err("vault root must be an absolute path".into());
    }
    // Recursive so vault notes + `.v5notes/**` are writable after dialog/reopen.
    // Explicit `.v5notes` allow keeps meta dirs reachable even if a host still
    // requires a literal leading dot in glob patterns.
    app.fs_scope()
        .allow_directory(&root, true)
        .map_err(|e| e.to_string())?;
    let meta = root.join(".v5notes");
    app.fs_scope()
        .allow_directory(&meta, true)
        .map_err(|e| e.to_string())?;
    // The `asset:` protocol checks its own scope (separate from plugin-fs at
    // runtime), so previews of `attachments/*` need the vault root allowed there too.
    app.asset_protocol_scope()
        .allow_directory(&root, true)
        .map_err(|e| e.to_string())?;
    Ok(())
}

/// Open http(s) / mailto in the system browser (OAuth authorize URL, help links).
#[tauri::command]
fn open_external_url(url: String) -> Result<(), String> {
    let Some(target) = openable_external_url(&url) else {
        return Err("只能打开 http、https 或 mailto 链接".into());
    };
    open_with_system(target).map_err(|error| format!("无法打开链接: {error}"))
}

fn openable_external_url(url: &str) -> Option<&str> {
    let target = url.trim();
    if target.is_empty() || target.chars().any(|ch| ch.is_control() || ch.is_whitespace()) {
        return None;
    }
    let lower = target.to_ascii_lowercase();
    if let Some(address) = lower.strip_prefix("mailto:") {
        if address.is_empty() {
            return None;
        }
        return Some(target);
    }
    let scheme_len = if lower.starts_with("https://") {
        "https://".len()
    } else if lower.starts_with("http://") {
        "http://".len()
    } else {
        return None;
    };
    let rest = &target[scheme_len..];
    if rest.is_empty() || rest.starts_with('/') || rest.starts_with('.') {
        return None;
    }
    Some(target)
}

fn open_with_system(url: &str) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        Command::new("open").arg(url).spawn().map(|_| ()).map_err(|e| e.to_string())
    }
    #[cfg(target_os = "windows")]
    {
        Command::new("rundll32")
            .args(["url.dll,FileProtocolHandler", url])
            .spawn()
            .map(|_| ())
            .map_err(|e| e.to_string())
    }
    #[cfg(all(unix, not(target_os = "macos")))]
    {
        Command::new("xdg-open")
            .arg(url)
            .spawn()
            .map(|_| ())
            .map_err(|e| e.to_string())
    }
}

/// Session tokens in the OS keychain (macOS Keychain / Windows Credential
/// Manager / Linux Secret Service via the `keyring` crate). One entry per
/// account label; both tokens share a serialized payload so they rotate
/// together. Username stays client-side — it is not a secret.
const KEYCHAIN_SERVICE: &str = "com.v5notes.vault-client";

#[derive(serde::Serialize, serde::Deserialize)]
struct KeychainPayload {
    token: String,
    #[serde(rename = "refreshToken")]
    refresh_token: String,
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct KeychainArgs {
    account: String,
    /// "get" | "set" | "delete"
    operation: String,
    #[serde(default)]
    token: String,
    #[serde(default)]
    refresh_token: String,
}

#[tauri::command]
fn keychain(args: KeychainArgs) -> Result<Option<KeychainPayload>, String> {
    if args.account.is_empty() || args.account.contains(['/', '\\', '\0']) {
        return Err("invalid keychain account".into());
    }
    let entry = keyring::Entry::new(KEYCHAIN_SERVICE, &args.account).map_err(|e| e.to_string())?;
    match args.operation.as_str() {
        "get" => match entry.get_password() {
            Ok(json) => serde_json::from_str(&json).map(Some).map_err(|e| e.to_string()),
            Err(keyring::Error::NoEntry) => Ok(None),
            Err(e) => Err(e.to_string()),
        },
        "set" => {
            let payload = KeychainPayload {
                token: args.token,
                refresh_token: args.refresh_token,
            };
            // Empty access token means nothing worth keeping: drop the entry.
            if payload.token.is_empty() {
                let _ = entry.delete_credential();
                return Ok(None);
            }
            let json = serde_json::to_string(&payload).map_err(|e| e.to_string())?;
            entry.set_password(&json).map_err(|e| e.to_string())?;
            Ok(Some(payload))
        }
        "delete" => {
            // Missing entry is fine — clearing an already-cleared session.
            let _ = entry.delete_credential();
            Ok(None)
        }
        other => Err(format!("unknown keychain operation: {other}")),
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            allow_vault_directory,
            open_external_url,
            keychain
        ])
        .setup(|app| {
            // Linux / Windows debug builds can register the scheme at runtime.
            // macOS registers via the packaged Info.plist after install/bundle.
            #[cfg(any(target_os = "linux", all(debug_assertions, windows)))]
            {
                use tauri_plugin_deep_link::DeepLinkExt;
                let _ = app.deep_link().register_all();
            }
            let _ = app;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("failed to start V5Notes Vault");
}
