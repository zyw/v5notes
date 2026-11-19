use std::path::PathBuf;
use std::process::Command;
#[cfg(not(any(target_os = "android", target_os = "ios")))]
use std::sync::atomic::{AtomicU64, Ordering};
#[cfg(not(any(target_os = "android", target_os = "ios")))]
use std::sync::Mutex;

use tauri::Manager;
use tauri_plugin_fs::FsExt;

/// 内置的更新清单地址。Vault 用自己的 vault-latest.json，与 Cloud 的
/// latest.json 分开；同一个 Release 里两者可以并存，客户端各取各的。
#[cfg(not(any(target_os = "android", target_os = "ios")))]
const UPDATE_FEED: &str = "https://github.com/zyw/v5notes/releases/latest/download/vault-latest.json";

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

// ---------------------------------------------------------------------------
// 在线升级
//
// 检查、下载、安装分三步，由 `app_update_check` / `app_update_download` /
// `app_update_install` 分别驱动。下载的字节留在 AppState 里直到安装，
// 这样「稍后重启」不会丢掉已下载的包；取消下载只递增 generation，
// 迟到的下载结果不会覆盖新的检查结果。
// ---------------------------------------------------------------------------

/// 只接受 https 清单地址。非法或空值回退到内置的 GitHub Release 地址。
#[cfg(not(any(target_os = "android", target_os = "ios")))]
fn https_update_feed(value: &str) -> Option<&str> {
    let target = value.trim();
    let rest = target.strip_prefix("https://")?;
    if rest.is_empty() || rest.chars().any(|ch| ch.is_whitespace() || ch.is_control()) {
        return None;
    }
    Some(target)
}

#[cfg(not(any(target_os = "android", target_os = "ios")))]
#[derive(Default)]
struct HeldUpdate {
    update: Mutex<Option<tauri_plugin_updater::Update>>,
    bytes: Mutex<Option<Vec<u8>>>,
    generation: AtomicU64,
}

#[cfg(not(any(target_os = "android", target_os = "ios")))]
impl HeldUpdate {
    fn store(&self, update: tauri_plugin_updater::Update) {
        self.generation.fetch_add(1, Ordering::SeqCst);
        *self.bytes.lock().expect("update bytes") = None;
        *self.update.lock().expect("update") = Some(update);
    }

    fn clone_update(&self) -> Option<tauri_plugin_updater::Update> {
        self.update.lock().expect("update").clone()
    }

    fn store_bytes(&self, bytes: Vec<u8>) {
        *self.bytes.lock().expect("update bytes") = Some(bytes);
    }

    fn take_bytes(&self) -> Option<Vec<u8>> {
        self.bytes.lock().expect("update bytes").take()
    }

    fn clear(&self) {
        self.generation.fetch_add(1, Ordering::SeqCst);
        *self.update.lock().expect("update") = None;
        *self.bytes.lock().expect("update bytes") = None;
    }

    fn cancel_download(&self) {
        self.generation.fetch_add(1, Ordering::SeqCst);
        *self.bytes.lock().expect("update bytes") = None;
    }

    fn current_generation(&self) -> u64 {
        self.generation.load(Ordering::SeqCst)
    }
}

/// 检查结果回给前端的形状。字段在移动端 stub 里不被读取。
#[allow(dead_code)]
#[derive(serde::Serialize)]
struct UpdateOffer {
    version: String,
    notes: String,
    date: Option<String>,
}

#[cfg(not(any(target_os = "android", target_os = "ios")))]
#[derive(Clone, serde::Serialize)]
struct UpdateProgress {
    received: usize,
    total: Option<u64>,
}

/// V5NOTES_UPDATE_FEED 指向自建镜像时使用；值不是 https 就忽略。
#[cfg(not(any(target_os = "android", target_os = "ios")))]
fn feed_override() -> Option<String> {
    let value = std::env::var("V5NOTES_UPDATE_FEED").ok()?;
    let endpoint = https_update_feed(&value)?;
    if endpoint == UPDATE_FEED {
        return None;
    }
    Some(endpoint.to_string())
}

#[cfg(not(any(target_os = "android", target_os = "ios")))]
#[tauri::command]
async fn app_update_check(app: tauri::AppHandle) -> Result<Option<UpdateOffer>, String> {
    use tauri_plugin_updater::UpdaterExt;

    let mut builder = app.updater_builder();
    if let Some(endpoint) = feed_override() {
        let url = endpoint
            .parse()
            .map_err(|_| "更新地址无效".to_string())?;
        builder = builder
            .endpoints(vec![url])
            .map_err(|error| error.to_string())?;
    }
    let update = builder
        .build()
        .map_err(|error| error.to_string())?
        .check()
        .await
        .map_err(|error| error.to_string())?;
    let Some(update) = update else {
        app.state::<HeldUpdate>().clear();
        return Ok(None);
    };
    let date = update
        .raw_json
        .get("pub_date")
        .and_then(|value| value.as_str())
        .map(str::to_string);
    let offer = UpdateOffer {
        version: update.version.clone(),
        notes: update.body.clone().unwrap_or_default(),
        date,
    };
    app.state::<HeldUpdate>().store(update);
    Ok(Some(offer))
}

#[cfg(not(any(target_os = "android", target_os = "ios")))]
#[tauri::command]
async fn app_update_download(app: tauri::AppHandle) -> Result<(), String> {
    use tauri::Emitter;

    let (generation, update) = {
        let held = app.state::<HeldUpdate>();
        (held.current_generation(), held.clone_update())
    };
    let update = update.ok_or_else(|| "没有待下载的更新".to_string())?;
    let progress = app.clone();
    let bytes = update
        .download(
            move |chunk, total| {
                let _ = progress.emit(
                    "update-download-progress",
                    UpdateProgress {
                        received: chunk,
                        total,
                    },
                );
            },
            || {},
        )
        .await
        .map_err(|error| error.to_string())?;
    let held = app.state::<HeldUpdate>();
    if held.current_generation() != generation {
        return Err("下载已取消".into());
    }
    held.store_bytes(bytes);
    Ok(())
}

#[cfg(not(any(target_os = "android", target_os = "ios")))]
#[tauri::command]
fn app_update_install(app: tauri::AppHandle) -> Result<(), String> {
    let held = app.state::<HeldUpdate>();
    let update = held
        .clone_update()
        .ok_or_else(|| "没有待安装的更新".to_string())?;
    let bytes = held
        .take_bytes()
        .ok_or_else(|| "更新包还没有下载完成".to_string())?;
    update.install(bytes).map_err(|error| error.to_string())
}

#[cfg(not(any(target_os = "android", target_os = "ios")))]
#[tauri::command]
fn app_update_close(app: tauri::AppHandle) {
    app.state::<HeldUpdate>().clear();
}

#[cfg(not(any(target_os = "android", target_os = "ios")))]
#[tauri::command]
fn app_update_cancel(app: tauri::AppHandle) {
    app.state::<HeldUpdate>().cancel_download();
}

#[cfg(any(target_os = "android", target_os = "ios"))]
#[tauri::command]
async fn app_update_check() -> Result<Option<UpdateOffer>, String> {
    Err("此平台不支持应用内更新".into())
}

#[cfg(any(target_os = "android", target_os = "ios"))]
#[tauri::command]
async fn app_update_download() -> Result<(), String> {
    Err("此平台不支持应用内更新".into())
}

#[cfg(any(target_os = "android", target_os = "ios"))]
#[tauri::command]
fn app_update_install() -> Result<(), String> {
    Err("此平台不支持应用内更新".into())
}

#[cfg(any(target_os = "android", target_os = "ios"))]
#[tauri::command]
fn app_update_close() {}

#[cfg(any(target_os = "android", target_os = "ios"))]
#[tauri::command]
fn app_update_cancel() {}

#[tauri::command]
fn update_host_os() -> &'static str {
    if cfg!(windows) {
        "windows"
    } else if cfg!(target_os = "macos") {
        "macos"
    } else {
        "linux"
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    #[cfg(not(any(target_os = "android", target_os = "ios")))]
    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init());

    #[cfg(any(target_os = "android", target_os = "ios"))]
    let builder = tauri::Builder::default();

    builder
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            allow_vault_directory,
            open_external_url,
            keychain,
            update_host_os,
            app_update_check,
            app_update_download,
            app_update_install,
            app_update_close,
            app_update_cancel
        ])
        .setup(|app| {
            #[cfg(not(any(target_os = "android", target_os = "ios")))]
            app.manage(HeldUpdate::default());
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

#[cfg(all(test, not(any(target_os = "android", target_os = "ios"))))]
mod update_tests {
    use super::https_update_feed;

    #[test]
    fn accepts_only_https_update_feeds() {
        assert_eq!(
            https_update_feed(" https://github.com/zyw/v5notes/releases/latest/download/latest.json "),
            Some("https://github.com/zyw/v5notes/releases/latest/download/latest.json")
        );
        assert_eq!(https_update_feed("http://example.com/latest.json"), None);
        assert_eq!(https_update_feed("https://"), None);
        assert_eq!(https_update_feed("https://example.com/a b.json"), None);
        assert_eq!(https_update_feed("https://example.com/\u{7}"), None);
    }
}
