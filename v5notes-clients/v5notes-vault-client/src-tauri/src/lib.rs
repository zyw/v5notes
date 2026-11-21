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

// ---------------------------------------------------------------------------
// 导入扩展包
//
// 「导入」只把 zip 读成文件映射，交给前端放进 pending/ 暂存区；真正写进
// extensions/plugins 仍由前端 installCatalogPackage 负责。这样解压的边界检查
// （条目名、大小、编码）留在 Rust，写入路径只有一份实现。
// ---------------------------------------------------------------------------

/// 一个扩展包最多多少个文件、单文件多大、解开后总量多大。
const ZIP_MAX_ENTRIES: usize = 64;
const ZIP_MAX_FILE_BYTES: u64 = 1024 * 1024;
const ZIP_MAX_TOTAL_BYTES: u64 = 4 * 1024 * 1024;

#[derive(serde::Serialize, Debug)]
struct ExtensionZip {
    files: std::collections::BTreeMap<String, String>,
}

/// 包内文件名必须是平铺的单段名字：与前端 installCatalogPackage 的规则一致
/// （不允许子目录、不许 ..，否则会把文件写到插件目录之外）。
fn zip_entry_name_ok(name: &str) -> bool {
    if name.is_empty() || name == "." || name == ".." {
        return false;
    }
    if name.starts_with('.') || name.contains('/') || name.contains('\\') || name.contains('\0') {
        return false;
    }
    !name.chars().any(char::is_control)
}

fn read_extension_zip_files(path: &std::path::Path) -> Result<ExtensionZip, String> {
    let file = std::fs::File::open(path).map_err(|e| format!("无法打开扩展包: {e}"))?;
    let mut archive = zip::ZipArchive::new(file).map_err(|e| format!("不是有效的 zip: {e}"))?;
    if archive.len() > ZIP_MAX_ENTRIES {
        return Err(format!("扩展包文件过多（上限 {ZIP_MAX_ENTRIES} 个）"));
    }
    let mut files = std::collections::BTreeMap::new();
    let mut total: u64 = 0;
    for index in 0..archive.len() {
        let mut entry = archive
            .by_index(index)
            .map_err(|e| format!("读取扩展包条目失败: {e}"))?;
        if entry.is_dir() {
            continue;
        }
        // zip slip：条目名可能带路径，只接受平铺文件名。
        let name = entry.name().to_string();
        if !zip_entry_name_ok(&name) {
            return Err(format!("扩展包内文件名不合法「{name}」：只支持根目录下的文件"));
        }
        if entry.size() > ZIP_MAX_FILE_BYTES {
            return Err(format!("文件「{name}」超过 1 MiB"));
        }
        let mut raw = Vec::new();
        std::io::Read::read_to_end(&mut entry, &mut raw)
            .map_err(|e| format!("读取文件「{name}」失败: {e}"))?;
        total = total.saturating_add(raw.len() as u64);
        if total > ZIP_MAX_TOTAL_BYTES {
            return Err("扩展包解压后超过 4 MiB".into());
        }
        let text = String::from_utf8(raw)
            .map_err(|_| format!("文件「{name}」不是 UTF-8 文本，扩展包只接受文本文件"))?;
        files.insert(name, text);
    }
    if !files.contains_key("manifest.json") {
        return Err("扩展包缺少根目录下的 manifest.json".into());
    }
    Ok(ExtensionZip { files })
}

#[tauri::command]
fn read_extension_zip(path: String) -> Result<ExtensionZip, String> {
    let file = PathBuf::from(&path);
    if !file.is_absolute() {
        return Err("扩展包路径必须是绝对路径".into());
    }
    read_extension_zip_files(&file)
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
            read_extension_zip,
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

#[cfg(test)]
mod extension_zip_tests {
    use super::{read_extension_zip_files, zip_entry_name_ok};

    /// 用最小的 stored（不压缩）zip 造一个包，避免测试依赖压缩实现。
    fn write_zip(path: &std::path::Path, entries: &[(&str, &[u8])]) {
        let mut body = Vec::new();
        let mut central = Vec::new();
        for (name, data) in entries {
            let offset = body.len() as u32;
            let crc = crc32(data);
            body.extend_from_slice(&0x0403_4b50u32.to_le_bytes());
            body.extend_from_slice(&20u16.to_le_bytes());
            body.extend_from_slice(&0u16.to_le_bytes());
            body.extend_from_slice(&0u16.to_le_bytes());
            body.extend_from_slice(&0u16.to_le_bytes());
            body.extend_from_slice(&0u16.to_le_bytes());
            body.extend_from_slice(&crc.to_le_bytes());
            body.extend_from_slice(&(data.len() as u32).to_le_bytes());
            body.extend_from_slice(&(data.len() as u32).to_le_bytes());
            body.extend_from_slice(&(name.len() as u16).to_le_bytes());
            body.extend_from_slice(&0u16.to_le_bytes());
            body.extend_from_slice(name.as_bytes());
            body.extend_from_slice(data);

            central.extend_from_slice(&0x0201_4b50u32.to_le_bytes());
            central.extend_from_slice(&20u16.to_le_bytes());
            central.extend_from_slice(&20u16.to_le_bytes());
            central.extend_from_slice(&0u16.to_le_bytes());
            central.extend_from_slice(&0u16.to_le_bytes());
            central.extend_from_slice(&0u16.to_le_bytes());
            central.extend_from_slice(&0u16.to_le_bytes());
            central.extend_from_slice(&crc.to_le_bytes());
            central.extend_from_slice(&(data.len() as u32).to_le_bytes());
            central.extend_from_slice(&(data.len() as u32).to_le_bytes());
            central.extend_from_slice(&(name.len() as u16).to_le_bytes());
            central.extend_from_slice(&0u16.to_le_bytes());
            central.extend_from_slice(&0u16.to_le_bytes());
            central.extend_from_slice(&0u16.to_le_bytes());
            central.extend_from_slice(&0u16.to_le_bytes());
            central.extend_from_slice(&0u32.to_le_bytes());
            central.extend_from_slice(&offset.to_le_bytes());
            central.extend_from_slice(name.as_bytes());
        }
        let central_offset = body.len() as u32;
        let mut out = body;
        out.extend_from_slice(&central);
        let central_size = central.len() as u32;
        out.extend_from_slice(&0x0605_4b50u32.to_le_bytes());
        out.extend_from_slice(&0u16.to_le_bytes());
        out.extend_from_slice(&0u16.to_le_bytes());
        out.extend_from_slice(&(entries.len() as u16).to_le_bytes());
        out.extend_from_slice(&(entries.len() as u16).to_le_bytes());
        out.extend_from_slice(&central_size.to_le_bytes());
        out.extend_from_slice(&central_offset.to_le_bytes());
        out.extend_from_slice(&0u16.to_le_bytes());
        std::fs::write(path, out).unwrap();
    }

    fn crc32(data: &[u8]) -> u32 {
        let mut crc = 0xffff_ffffu32;
        for byte in data {
            crc ^= *byte as u32;
            for _ in 0..8 {
                crc = if crc & 1 == 1 { (crc >> 1) ^ 0xedb8_8320 } else { crc >> 1 };
            }
        }
        !crc
    }

    fn temp_zip(name: &str) -> std::path::PathBuf {
        let path = std::env::temp_dir().join(name);
        let _ = std::fs::remove_file(&path);
        path
    }

    #[test]
    fn accepts_flat_text_package() {
        let path = temp_zip("v5notes-ext-ok.zip");
        write_zip(&path, &[
            ("manifest.json", b"{\"id\":\"demo\"}"),
            ("main.js", b"module.exports = class {}"),
        ]);
        let zip = read_extension_zip_files(&path).unwrap();
        assert_eq!(zip.files.len(), 2);
        assert!(zip.files.contains_key("manifest.json"));
        let _ = std::fs::remove_file(&path);
    }

    #[test]
    fn requires_root_manifest() {
        let path = temp_zip("v5notes-ext-no-manifest.zip");
        write_zip(&path, &[("main.js", b"x")]);
        assert!(read_extension_zip_files(&path).unwrap_err().contains("manifest.json"));
        let _ = std::fs::remove_file(&path);
    }

    #[test]
    fn rejects_nested_and_traversing_names() {
        let path = temp_zip("v5notes-ext-nested.zip");
        write_zip(&path, &[
            ("manifest.json", b"{}"),
            ("dist/main.js", b"x"),
        ]);
        assert!(read_extension_zip_files(&path).unwrap_err().contains("文件名不合法"));
        let _ = std::fs::remove_file(&path);
    }

    #[test]
    fn rejects_non_utf8_payload() {
        let path = temp_zip("v5notes-ext-binary.zip");
        write_zip(&path, &[
            ("manifest.json", b"{}"),
            ("main.js", &[0xff, 0xfe, 0x00]),
        ]);
        assert!(read_extension_zip_files(&path).unwrap_err().contains("UTF-8"));
        let _ = std::fs::remove_file(&path);
    }

    /// 仓库里随源码保存的测试包：导入流程用它验证端到端行为。
    #[test]
    fn reads_the_shipped_import_test_zip() {
        let zip_path = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("../src/plugin-host/samples/import-test.zip");
        let zip = read_extension_zip_files(&zip_path).unwrap();
        assert_eq!(
            zip.files.keys().cloned().collect::<Vec<_>>(),
            vec!["main.js".to_string(), "manifest.json".to_string()]
        );
        assert!(zip.files["manifest.json"].contains("\"id\": \"import-test\""));
        assert!(zip.files["main.js"].contains("module.exports"));
    }

    #[test]
    fn entry_name_rules() {
        assert!(zip_entry_name_ok("manifest.json"));
        assert!(zip_entry_name_ok("main.js"));
        assert!(!zip_entry_name_ok(""));
        assert!(!zip_entry_name_ok(".."));
        assert!(!zip_entry_name_ok(".hidden"));
        assert!(!zip_entry_name_ok("a/b.js"));
        assert!(!zip_entry_name_ok("a\\b.js"));
    }
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
