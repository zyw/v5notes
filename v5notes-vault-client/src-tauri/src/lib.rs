use std::path::PathBuf;

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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![allow_vault_directory])
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
