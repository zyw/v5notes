use std::path::PathBuf;
use std::process::Command;

use tauri_plugin_fs::FsExt;

#[tauri::command]
fn allow_vault_directory(app: tauri::AppHandle, path: String) -> Result<(), String> {
    let root = PathBuf::from(&path);
    if !root.is_absolute() {
        return Err("vault root must be an absolute path".into());
    }
    app.fs_scope()
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![allow_vault_directory, open_external_url])
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
