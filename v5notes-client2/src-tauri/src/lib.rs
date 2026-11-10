use std::process::Command;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Mutex;
use tauri::{
    image::Image,
    menu::{AboutMetadata, Menu, MenuItem, PredefinedMenuItem, Submenu},
    tray::TrayIconBuilder,
    Emitter, Manager,
};
#[cfg(not(any(target_os = "android", target_os = "ios")))]
use tauri_plugin_autostart::ManagerExt as AutostartManagerExt;

const UPDATE_FEED: &str = "https://github.com/zyw/v5notes/releases/latest/download/latest.json";

const PROJECT_URL: &str = "https://github.com/zyw/v5notes";

static APP_LOCALE: Mutex<String> = Mutex::new(String::new());

fn locale_code() -> String {
    APP_LOCALE.lock().map(|value| value.clone()).unwrap_or_default()
}

fn set_locale_code(value: &str) {
    let normalized = match value {
        "zh-TW" | "zh-HK" | "zh-Hant" => "zh-TW",
        "en" | "en-US" | "en-GB" => "en",
        _ => "zh-CN",
    };
    if let Ok(mut slot) = APP_LOCALE.lock() {
        *slot = normalized.to_string();
    }
}

fn tr(zh_cn: &str, zh_tw: &str, en: &str) -> String {
    match locale_code().as_str() {
        "zh-TW" => zh_tw.to_string(),
        "en" => en.to_string(),
        _ => zh_cn.to_string(),
    }
}

fn tr_detail(zh_cn: &str, zh_tw: &str, en: &str, detail: impl std::fmt::Display) -> String {
    match locale_code().as_str() {
        "en" => format!("{en}: {detail}"),
        "zh-TW" => format!("{zh_tw}：{detail}"),
        _ => format!("{zh_cn}：{detail}"),
    }
}

fn app_display_name() -> String {
    tr("V5Notes云笔记", "V5Notes雲筆記", "V5Notes")
}

fn quit_label() -> String {
    let name = app_display_name();
    match locale_code().as_str() {
        "zh-TW" => format!("結束 {name}"),
        "en" => format!("Quit {name}"),
        _ => format!("退出 {name}"),
    }
}

fn about_menu_label() -> String {
    let name = app_display_name();
    match locale_code().as_str() {
        "zh-TW" => format!("關於 {name}"),
        "en" => format!("About {name}"),
        _ => format!("关于 {name}"),
    }
}

fn hide_menu_label() -> String {
    let name = app_display_name();
    match locale_code().as_str() {
        "zh-TW" => format!("隱藏 {name}"),
        "en" => format!("Hide {name}"),
        _ => format!("隐藏 {name}"),
    }
}

fn about_credits() -> String {
    format!(
        "{}\n\n{}",
        tr(
            "连接你的笔记空间，继续写作。",
            "連接你的筆記空間，繼續寫作。",
            "Connect to your notes and keep writing."
        ),
        PROJECT_URL
    )
}

#[cfg(desktop)]
fn application_menu(app: &tauri::AppHandle) -> tauri::Result<Menu<tauri::Wry>> {
    let name = app_display_name();
    let metadata = AboutMetadata {
        name: Some(name.clone()),
        version: Some(app.package_info().version.to_string()),
        copyright: Some(tr("把想法留在这里。", "把想法留在這裡。", "Keep your ideas here.")),
        credits: Some(about_credits()),
        comments: Some(tr(
            "连接你的笔记空间，继续写作。",
            "連接你的筆記空間，繼續寫作。",
            "Connect to your notes and keep writing.",
        )),
        website: Some(PROJECT_URL.to_string()),
        website_label: Some(tr("项目主页", "專案首頁", "Project page")),
        icon: Some(Image::from_bytes(include_bytes!("../icons/128x128@2x.png"))?),
        ..Default::default()
    };

    let window_menu = Submenu::with_items(
        app,
        "Window",
        true,
        &[
            &PredefinedMenuItem::minimize(app, None)?,
            &PredefinedMenuItem::maximize(app, None)?,
            #[cfg(target_os = "macos")]
            &PredefinedMenuItem::separator(app)?,
            &PredefinedMenuItem::close_window(app, None)?,
        ],
    )?;
    let help_menu = Submenu::with_items(
        app,
        "Help",
        true,
        &[
            #[cfg(not(target_os = "macos"))]
            &PredefinedMenuItem::about(app, Some(&about_menu_label()), Some(metadata.clone()))?,
        ],
    )?;

    Menu::with_items(
        app,
        &[
            #[cfg(target_os = "macos")]
            &Submenu::with_items(
                app,
                &name,
                true,
                &[
                    &PredefinedMenuItem::about(app, Some(&about_menu_label()), Some(metadata))?,
                    &PredefinedMenuItem::separator(app)?,
                    &PredefinedMenuItem::services(app, None)?,
                    &PredefinedMenuItem::separator(app)?,
                    &PredefinedMenuItem::hide(app, Some(&hide_menu_label()))?,
                    &PredefinedMenuItem::hide_others(app, None)?,
                    &PredefinedMenuItem::separator(app)?,
                    &PredefinedMenuItem::quit(app, Some(&quit_label()))?,
                ],
            )?,
            #[cfg(not(any(
                target_os = "linux",
                target_os = "dragonfly",
                target_os = "freebsd",
                target_os = "netbsd",
                target_os = "openbsd"
            )))]
            &Submenu::with_items(
                app,
                "File",
                true,
                &[
                    &PredefinedMenuItem::close_window(app, None)?,
                    #[cfg(not(target_os = "macos"))]
                    &PredefinedMenuItem::quit(app, Some(&quit_label()))?,
                ],
            )?,
            &Submenu::with_items(
                app,
                "Edit",
                true,
                &[
                    &PredefinedMenuItem::undo(app, None)?,
                    &PredefinedMenuItem::redo(app, None)?,
                    &PredefinedMenuItem::separator(app)?,
                    &PredefinedMenuItem::cut(app, None)?,
                    &PredefinedMenuItem::copy(app, None)?,
                    &PredefinedMenuItem::paste(app, None)?,
                    &PredefinedMenuItem::select_all(app, None)?,
                ],
            )?,
            #[cfg(target_os = "macos")]
            &Submenu::with_items(app, "View", true, &[&PredefinedMenuItem::fullscreen(app, None)?])?,
            &window_menu,
            &help_menu,
        ],
    )
}

/// 只接受 https 清单地址。非法或空值回退到内置的 GitHub Release 地址。
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

#[derive(serde::Serialize)]
struct UpdateOffer {
    version: String,
    notes: String,
    date: Option<String>,
}

#[derive(Clone, serde::Serialize)]
struct UpdateProgress {
    received: usize,
    total: Option<u64>,
}

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
            .map_err(|_| tr("更新地址无效", "更新位址無效", "The update address is invalid"))?;
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
    let (generation, update) = {
        let held = app.state::<HeldUpdate>();
        (held.current_generation(), held.clone_update())
    };
    let update = update.ok_or(tr("没有待下载的更新", "沒有待下載的更新", "There is no update to download"))?;
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
        return Err(tr("下载已取消", "下載已取消", "Download cancelled").into());
    }
    held.store_bytes(bytes);
    Ok(())
}

#[cfg(not(any(target_os = "android", target_os = "ios")))]
#[tauri::command]
fn app_update_install(app: tauri::AppHandle) -> Result<(), String> {
    let held = app.state::<HeldUpdate>();
    let update = held.clone_update().ok_or(tr("没有待安装的更新", "沒有待安裝的更新", "There is no update to install"))?;
    let bytes = held.take_bytes().ok_or(tr("更新包还没有下载完成", "更新套件尚未下載完成", "The update has not finished downloading"))?;
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
    Err(tr("此平台不支持应用内更新", "此平台不支援應用程式內更新", "In-app updates are not supported on this platform").into())
}

#[cfg(any(target_os = "android", target_os = "ios"))]
#[tauri::command]
async fn app_update_download() -> Result<(), String> {
    Err(tr("此平台不支持应用内更新", "此平台不支援應用程式內更新", "In-app updates are not supported on this platform").into())
}

#[cfg(any(target_os = "android", target_os = "ios"))]
#[tauri::command]
fn app_update_install() -> Result<(), String> {
    Err(tr("此平台不支持应用内更新", "此平台不支援應用程式內更新", "In-app updates are not supported on this platform").into())
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

#[tauri::command]
fn exit_app(app: tauri::AppHandle) {
    app.exit(0);
}

#[tauri::command]
fn set_app_locale(app: tauri::AppHandle, locale: String) -> Result<(), String> {
    set_locale_code(&locale);
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.set_title(&app_display_name());
    }
    #[cfg(desktop)]
    app.set_menu(application_menu(&app).map_err(|error| error.to_string())?)
        .map_err(|error| error.to_string())?;
    if let Some(tray) = app.tray_by_id("main-tray") {
        let show = MenuItem::with_id(&app, "show", tr("显示窗口", "顯示視窗", "Show Window"), true, None::<&str>)
            .map_err(|error| error.to_string())?;
        let quit = MenuItem::with_id(&app, "quit", quit_label(), true, None::<&str>)
            .map_err(|error| error.to_string())?;
        let menu = Menu::with_items(&app, &[&show, &quit]).map_err(|error| error.to_string())?;
        tray.set_menu(Some(menu)).map_err(|error| error.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn open_project_link() -> Result<(), String> {
    open_with_system(PROJECT_URL).map_err(|error| tr_detail("无法打开项目主页", "無法開啟專案首頁", "Could not open the project page", error))
}

/// v5md asks for this when a note link is opened inside the webview.
/// The editor decides the gesture; this command only hands an http(s) or mailto URL to the OS.
#[tauri::command]
fn open_external_url(url: String) -> Result<(), String> {
    let Some(target) = openable_external_url(&url) else {
        return Err(tr("只能打开 http、https 或 mailto 链接", "只能開啟 http、https 或 mailto 連結", "Only http, https, or mailto links can be opened").into());
    };
    open_with_system(target).map_err(|error| tr_detail("无法打开链接", "無法開啟連結", "Could not open the link", error))
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
    let mut command = {
        let mut command = Command::new("open");
        command.arg(url);
        command
    };

    #[cfg(target_os = "windows")]
    let mut command = {
        let mut command = Command::new("rundll32");
        command.args(["url.dll,FileProtocolHandler", url]);
        command
    };

    #[cfg(all(unix, not(target_os = "macos")))]
    let mut command = {
        let mut command = Command::new("xdg-open");
        command.arg(url);
        command
    };

    command.spawn().map(|_| ()).map_err(|error| error.to_string())
}

#[tauri::command]
fn autostart_is_supported() -> bool {
    !cfg!(any(target_os = "android", target_os = "ios"))
}

#[tauri::command]
fn autostart_is_enabled(app: tauri::AppHandle) -> Result<bool, String> {
    #[cfg(not(any(target_os = "android", target_os = "ios")))]
    {
        app.autolaunch()
            .is_enabled()
            .map_err(|error| error.to_string())
    }

    #[cfg(any(target_os = "android", target_os = "ios"))]
    {
        let _ = app;
        Ok(false)
    }
}

#[tauri::command]
fn set_autostart_enabled(app: tauri::AppHandle, enabled: bool) -> Result<(), String> {
    #[cfg(not(any(target_os = "android", target_os = "ios")))]
    {
        let autolaunch = app.autolaunch();
        let result = if enabled {
            autolaunch.enable()
        } else {
            autolaunch.disable()
        };
        result.map_err(|error| error.to_string())
    }

    #[cfg(any(target_os = "android", target_os = "ios"))]
    {
        let _ = (app, enabled);
        Err(tr("此平台不支持登录系统后自动启动", "此平台不支援登入系統後自動啟動", "Launch at login is not supported on this platform").into())
    }
}

/// Exports the current editor view as a paginated, vector A4 PDF into the user's
/// Downloads folder, without opening the print dialog.
///
/// WKWebView's print pipeline produces a runaway document on recent macOS
/// releases, so the PDF is captured with `createPDF` and then repaginated into
/// A4 pages with Core Graphics. Text stays selectable and searchable.
#[cfg(target_os = "macos")]
#[tauri::command]
async fn export_pdf(
    window: tauri::WebviewWindow,
    file_name: String,
    x: f64,
    y: f64,
    width: f64,
    height: f64,
    slices: Vec<(f64, f64)>,
) -> Result<String, String> {
    use std::time::Duration;

    let name = file_name.trim().to_string();
    if name.is_empty() || name.contains('/') || name.contains('\\') || name.contains("..") {
        return Err(tr("文件名不合法", "檔名不合法", "The file name is not valid").into());
    }
    if !(x.is_finite() && y.is_finite() && width.is_finite() && height.is_finite())
        || width < 100.0
        || height < 100.0
    {
        return Err(tr("导出尺寸不合法", "匯出尺寸不合法", "The export size is not valid").into());
    }
    let home = std::env::var("HOME").map_err(|_| tr("找不到用户目录", "找不到使用者目錄", "Could not find the user directory"))?;
    let directory = std::path::Path::new(&home).join("Downloads");
    std::fs::create_dir_all(&directory).map_err(|error| error.to_string())?;
    let target = unique_target(&directory, &name);
    let path = target.to_string_lossy().to_string();
    let print_path = path.clone();

    let (sender, receiver) = std::sync::mpsc::channel();
    window
        .with_webview(move |platform_webview| {
            // SAFETY: Tauri runs this closure on the main thread with the live WKWebView.
            let result = unsafe {
                vector_pdf(platform_webview.inner(), x, y, width, height, slices, &print_path)
            };
            let _ = sender.send(result);
        })
        .map_err(|error| error.to_string())?;

    receiver
        .recv_timeout(Duration::from_secs(60))
        .map_err(|_| tr("导出超时", "匯出逾時", "Export timed out"))??;

    let bytes = std::fs::read(&target).map_err(|error| error.to_string())?;
    if bytes.len() < 1024 || !bytes.starts_with(b"%PDF") {
        let _ = std::fs::remove_file(&target);
        return Err(tr("生成的 PDF 无效", "產生的 PDF 無效", "The generated PDF is invalid").into());
    }
    Ok(path)
}

/// Captures the web content as one tall vector page, then slices it into A4 pages.
#[cfg(target_os = "macos")]
unsafe fn vector_pdf(
    webview: *mut std::ffi::c_void,
    x: f64,
    y: f64,
    width: f64,
    height: f64,
    slices: Vec<(f64, f64)>,
    path: &str,
) -> Result<(), String> {
    use block2::RcBlock;
    use objc2::rc::Retained;
    use objc2_core_foundation::{CGPoint, CGRect, CGSize};
    use objc2_core_graphics::{
        CGContext, CGDataProvider, CGPDFBox, CGPDFContextClose, CGPDFContextCreateWithURL,
        CGPDFDocument, CGPDFPage,
    };
    use objc2_core_foundation::{CFData, CFURL};
    use objc2_foundation::{NSData, NSDate, NSDefaultRunLoopMode, NSError, NSRunLoop, NSString, NSURL};
    use objc2_web_kit::{WKPDFConfiguration, WKWebView};

    let view: &WKWebView = unsafe { &*(webview as *const WKWebView) };
    let marker = unsafe { objc2::MainThreadMarker::new_unchecked() };
    let configuration = unsafe { WKPDFConfiguration::new(marker) };
    unsafe {
        configuration.setRect(CGRect {
            origin: CGPoint { x, y },
            size: CGSize { width, height },
        })
    };

    let (sender, receiver) = std::sync::mpsc::channel::<Result<Vec<u8>, String>>();
    let handler = RcBlock::new(move |data: *mut NSData, error: *mut NSError| {
        if !error.is_null() {
            let message = unsafe { (*error).localizedDescription() }.to_string();
            let _ = sender.send(Err(message));
        } else if data.is_null() {
            let _ = sender.send(Err(tr("PDF 数据为空", "PDF 資料是空的", "The PDF data is empty")));
        } else {
            let bytes = unsafe { (*data).to_vec() };
            let _ = sender.send(Ok(bytes));
        }
    });
    unsafe { view.createPDFWithConfiguration_completionHandler(Some(&configuration), &handler) };

    // createPDF answers on the main thread, so pump the run loop until it does.
    let deadline = std::time::Instant::now() + std::time::Duration::from_secs(30);
    let source = loop {
        match receiver.try_recv() {
            Ok(result) => break result?,
            Err(std::sync::mpsc::TryRecvError::Disconnected) => return Err(tr("PDF 生成被中断", "PDF 產生被中斷", "PDF generation was interrupted").into()),
            Err(std::sync::mpsc::TryRecvError::Empty) => {}
        }
        if std::time::Instant::now() > deadline {
            return Err(tr("PDF 生成超时", "PDF 產生逾時", "PDF generation timed out").into());
        }
        let date = NSDate::dateWithTimeIntervalSinceNow(0.02);
        let mode = unsafe { NSDefaultRunLoopMode };
        NSRunLoop::currentRunLoop().runMode_beforeDate(mode, &date);
    };

    // ---- repaginate into A4 ----
    let data = CFData::from_bytes(&source);
    let provider = CGDataProvider::with_cf_data(Some(&data)).ok_or(tr("无法读取 PDF 数据", "無法讀取 PDF 資料", "Could not read the PDF data"))?;
    let document = CGPDFDocument::with_provider(Some(&provider)).ok_or(tr("无法解析 PDF", "無法解析 PDF", "Could not parse the PDF"))?;
    let page = CGPDFDocument::page(Some(&document), 1).ok_or(tr("PDF 没有页面", "PDF 沒有頁面", "The PDF has no pages"))?;
    let bounds = CGPDFPage::box_rect(Some(&page), CGPDFBox::MediaBox);
    if bounds.size.height <= 1.0 {
        return Err(tr("PDF 页面高度异常", "PDF 頁面高度異常", "The PDF page height is invalid").into());
    }

    let page_width = 595.28_f64;
    let page_height = 841.89_f64;
    // ~18mm left/right, ~17mm top/bottom.
    let margin_x = 51.0_f64;
    let margin_y = 48.0_f64;
    let content_width = page_width - margin_x * 2.0;
    let content_height = page_height - margin_y * 2.0;
    let scale = content_width / bounds.size.width;
    // Each slice is (top, height) in source pixels; empty means "split evenly".
    // The frontend breaks pages on block boundaries so images are never cut.
    let ranges: Vec<(f64, f64)> = if slices.is_empty() {
        let page_px = content_height / scale;
        let count = (bounds.size.height / page_px).ceil().max(1.0) as usize;
        (0..count)
            .map(|index| {
                let top = index as f64 * page_px;
                (top, (bounds.size.height - top).min(page_px).max(1.0))
            })
            .collect()
    } else {
        slices
    };

    let ns_url = NSURL::fileURLWithPath(&NSString::from_str(path));
    let url: &CFURL = unsafe { &*(Retained::as_ptr(&ns_url) as *const CFURL) };
    let media = CGRect {
        origin: CGPoint { x: 0.0, y: 0.0 },
        size: CGSize { width: page_width, height: page_height },
    };
    let context = unsafe { CGPDFContextCreateWithURL(Some(url), &media, None) }.ok_or(tr("无法创建 PDF 文件", "無法建立 PDF 檔案", "Could not create the PDF file"))?;

    for (top_px, height_px) in ranges {
        let slice_height = (height_px * scale).max(1.0);
        // Content sits inside the page margins: the top margin is where the slice ends.
        let slice = CGRect {
            origin: CGPoint {
                x: margin_x,
                y: page_height - margin_y - slice_height,
            },
            size: CGSize { width: content_width, height: slice_height },
        };
        // x' = margin_x + scale * x, y' = scale * y + offset, placing this slice's
        // top edge on the top margin.
        let offset = (page_height - margin_y) - scale * (bounds.size.height - top_px);
        let transform = objc2_core_foundation::CGAffineTransform {
            a: scale,
            b: 0.0,
            c: 0.0,
            d: scale,
            tx: margin_x,
            ty: offset,
        };
        unsafe {
            CGContext::begin_page(Some(&context), &slice);
            CGContext::save_g_state(Some(&context));
            CGContext::clip_to_rect(Some(&context), slice);
            CGContext::concat_ctm(Some(&context), transform);
            CGContext::draw_pdf_page(Some(&context), Some(&page));
            CGContext::restore_g_state(Some(&context));
            CGContext::end_page(Some(&context));
        }
    }
    CGPDFContextClose(Some(&context));
    Ok(())
}

#[cfg(target_os = "macos")]
fn unique_target(directory: &std::path::Path, name: &str) -> std::path::PathBuf {
    let candidate = directory.join(name);
    if !candidate.exists() {
        return candidate;
    }
    let stem = std::path::Path::new(name)
        .file_stem()
        .map(|value| value.to_string_lossy().to_string())
        .unwrap_or_else(|| name.to_string());
    for index in 2..1000 {
        let next = directory.join(format!("{stem} ({index}).pdf"));
        if !next.exists() {
            return next;
        }
    }
    candidate
}

#[cfg(not(target_os = "macos"))]
#[tauri::command]
async fn export_pdf(
    _window: tauri::WebviewWindow,
    _file_name: String,
    _x: f64,
    _y: f64,
    _width: f64,
    _height: f64,
    _slices: Vec<(f64, f64)>,
) -> Result<String, String> {
    Err(tr("当前平台暂不支持矢量 PDF，请使用图片版", "目前平台暫不支援向量 PDF，請改用圖片版", "Vector PDF is not available on this platform. Use the image version.").into())
}

/// Fetches an HTTP(S) image and returns it as a data URL. Webviews cannot read
/// cross-origin image bytes because of CORS, and drawing a cross-origin image
/// would taint the export canvas; going through Rust keeps PNG/PDF export intact
/// for the notes server and third-party image hosts alike.
#[tauri::command]
async fn fetch_image_data_url(url: String) -> Result<String, String> {
    use base64::Engine as _;
    use reqwest::header::CONTENT_TYPE;

    let target = url.trim();
    if !(target.starts_with("http://") || target.starts_with("https://")) {
        return Err(tr("只支持 http/https 图片", "只支援 http/https 圖片", "Only http/https images are supported").into());
    }
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|error| tr_detail("图片客户端初始化失败", "圖片用戶端初始化失敗", "Could not start the image client", error))?;
    let response = client
        .get(target)
        .send()
        .await
        .map_err(|error| tr_detail("图片请求失败", "圖片請求失敗", "Image request failed", error))?;
    if !response.status().is_success() {
        return Err(tr_detail("图片请求失败", "圖片請求失敗", "Image request failed", format!("HTTP {}", response.status())));
    }
    const MAX_IMAGE_BYTES: u64 = 40 * 1024 * 1024;
    if response.content_length().is_some_and(|length| length > MAX_IMAGE_BYTES) {
        return Err(tr("图片过大，无法嵌入", "圖片過大，無法嵌入", "The image is too large to embed").into());
    }
    let declared = response
        .headers()
        .get(CONTENT_TYPE)
        .and_then(|value| value.to_str().ok())
        .and_then(|value| value.split(';').next())
        .map(str::trim)
        .unwrap_or("")
        .to_string();
    let bytes = response
        .bytes()
        .await
        .map_err(|error| tr_detail("图片读取失败", "圖片讀取失敗", "Could not read the image", error))?;
    if bytes.len() as u64 > MAX_IMAGE_BYTES {
        return Err(tr("图片过大，无法嵌入", "圖片過大，無法嵌入", "The image is too large to embed").into());
    }
    // The notes server sends files as attachments without an image Content-Type,
    // and browsers need a usable MIME type for the data URL to decode.
    let mime = if declared.starts_with("image/") {
        declared
    } else {
        sniff_image_mime(&bytes).to_string()
    };
    Ok(format!(
        "data:{mime};base64,{}",
        base64::engine::general_purpose::STANDARD.encode(bytes)
    ))
}

fn sniff_image_mime(bytes: &[u8]) -> &'static str {
    if bytes.starts_with(&[0x89, b'P', b'N', b'G', 0x0d, 0x0a, 0x1a, 0x0a]) {
        "image/png"
    } else if bytes.starts_with(&[0xff, 0xd8, 0xff]) {
        "image/jpeg"
    } else if bytes.starts_with(b"GIF87a") || bytes.starts_with(b"GIF89a") {
        "image/gif"
    } else if bytes.len() >= 12 && &bytes[0..4] == b"RIFF" && &bytes[8..12] == b"WEBP" {
        "image/webp"
    } else if bytes.starts_with(b"<svg") || bytes.starts_with(b"<?xml") {
        "image/svg+xml"
    } else {
        "application/octet-stream"
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    #[cfg(not(any(target_os = "android", target_os = "ios")))]
    let builder = tauri::Builder::default()
        .plugin(
            tauri_plugin_autostart::Builder::new()
                .app_name("v5notes")
                .build(),
        )
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .menu(|app| application_menu(app));

    #[cfg(any(target_os = "android", target_os = "ios"))]
    let builder = tauri::Builder::default();

    builder
        .invoke_handler(tauri::generate_handler![
            exit_app,
            set_app_locale,
            open_project_link,
            open_external_url,
            export_pdf,
            fetch_image_data_url,
            autostart_is_supported,
            autostart_is_enabled,
            set_autostart_enabled,
            update_host_os,
            app_update_check,
            app_update_download,
            app_update_install,
            app_update_close,
            app_update_cancel
        ])
        .setup(|app| {
            let show = MenuItem::with_id(app, "show", tr("显示窗口", "顯示視窗", "Show Window"), true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", quit_label(), true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show, &quit])?;

            let tray_icon = Image::from_bytes(include_bytes!("../icons/tray-mono.png"))?;
            let tray = TrayIconBuilder::with_id("main-tray")
                .icon(tray_icon)
                .icon_as_template(true)
                .menu(&menu)
                .show_menu_on_left_click(true)
                .on_menu_event(|app, event| match event.id().as_ref() {
                    "show" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.unminimize();
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                    "quit" => {
                        let _ = app.emit_to("main", "app-exit-requested", ());
                    }
                    _ => {}
                })
                .build(app)?;

            app.manage(tray);
            #[cfg(not(any(target_os = "android", target_os = "ios")))]
            app.manage(HeldUpdate::default());
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("failed to start v5notes client");
}

#[cfg(test)]
mod tests {
    use super::{https_update_feed, openable_external_url};

    #[test]
    fn accepts_only_https_update_feeds() {
        assert_eq!(
            https_update_feed(" https://github.com/zyw/v5notes/releases/latest/download/latest.json "),
            Some("https://github.com/zyw/v5notes/releases/latest/download/latest.json")
        );
        assert_eq!(https_update_feed("http://example.com/latest.json"), None);
        assert_eq!(https_update_feed("https://"), None);
        assert_eq!(https_update_feed("https://example.com/a b.json"), None);
    }

    #[test]
    fn accepts_web_and_mail_links() {
        assert_eq!(
            openable_external_url(" https://example.com/a?b=1&c=2 "),
            Some("https://example.com/a?b=1&c=2")
        );
        assert_eq!(
            openable_external_url("mailto:hi@example.com"),
            Some("mailto:hi@example.com")
        );
    }

    #[test]
    fn rejects_local_and_script_links() {
        assert_eq!(openable_external_url("javascript:alert(1)"), None);
        assert_eq!(openable_external_url("file:///etc/passwd"), None);
        assert_eq!(openable_external_url("/notes/1"), None);
        assert_eq!(openable_external_url("https://example.com/a b"), None);
        assert_eq!(openable_external_url("http://"), None);
        assert_eq!(openable_external_url("mailto:"), None);
    }
}