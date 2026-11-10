use std::process::Command;
use tauri::{
    image::Image,
    menu::{Menu, MenuItem},
    tray::TrayIconBuilder,
    Emitter, Manager,
};
#[cfg(not(any(target_os = "android", target_os = "ios")))]
use tauri_plugin_autostart::ManagerExt as AutostartManagerExt;

const PROJECT_URL: &str = "https://github.com/zyw/v5notes";

#[tauri::command]
fn exit_app(app: tauri::AppHandle) {
    app.exit(0);
}

#[tauri::command]
fn open_project_link() -> Result<(), String> {
    open_with_system(PROJECT_URL).map_err(|error| format!("无法打开项目主页：{error}"))
}

/// v5md asks for this when a note link is opened inside the webview.
/// The editor decides the gesture; this command only hands an http(s) or mailto URL to the OS.
#[tauri::command]
fn open_external_url(url: String) -> Result<(), String> {
    let Some(target) = openable_external_url(&url) else {
        return Err("只能打开 http、https 或 mailto 链接".into());
    };
    open_with_system(target).map_err(|error| format!("无法打开链接：{error}"))
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
        Err("此平台不支持登录系统后自动启动".into())
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
        return Err("文件名不合法".into());
    }
    if !(x.is_finite() && y.is_finite() && width.is_finite() && height.is_finite())
        || width < 100.0
        || height < 100.0
    {
        return Err("导出尺寸不合法".into());
    }
    let home = std::env::var("HOME").map_err(|_| "找不到用户目录".to_string())?;
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
        .map_err(|_| "导出超时".to_string())??;

    let bytes = std::fs::read(&target).map_err(|error| error.to_string())?;
    if bytes.len() < 1024 || !bytes.starts_with(b"%PDF") {
        let _ = std::fs::remove_file(&target);
        return Err("生成的 PDF 无效".into());
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
            let _ = sender.send(Err("PDF 数据为空".to_string()));
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
            Err(std::sync::mpsc::TryRecvError::Disconnected) => return Err("PDF 生成被中断".into()),
            Err(std::sync::mpsc::TryRecvError::Empty) => {}
        }
        if std::time::Instant::now() > deadline {
            return Err("PDF 生成超时".into());
        }
        let date = NSDate::dateWithTimeIntervalSinceNow(0.02);
        let mode = unsafe { NSDefaultRunLoopMode };
        NSRunLoop::currentRunLoop().runMode_beforeDate(mode, &date);
    };

    // ---- repaginate into A4 ----
    let data = CFData::from_bytes(&source);
    let provider = CGDataProvider::with_cf_data(Some(&data)).ok_or("无法读取 PDF 数据")?;
    let document = CGPDFDocument::with_provider(Some(&provider)).ok_or("无法解析 PDF")?;
    let page = CGPDFDocument::page(Some(&document), 1).ok_or("PDF 没有页面")?;
    let bounds = CGPDFPage::box_rect(Some(&page), CGPDFBox::MediaBox);
    if bounds.size.height <= 1.0 {
        return Err("PDF 页面高度异常".into());
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
    let context = unsafe { CGPDFContextCreateWithURL(Some(url), &media, None) }.ok_or("无法创建 PDF 文件")?;

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
    Err("当前平台暂不支持矢量 PDF，请使用图片版".into())
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
        return Err("只支持 http/https 图片".into());
    }
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|error| format!("图片客户端初始化失败：{error}"))?;
    let response = client
        .get(target)
        .send()
        .await
        .map_err(|error| format!("图片请求失败：{error}"))?;
    if !response.status().is_success() {
        return Err(format!("图片请求失败：HTTP {}", response.status()));
    }
    const MAX_IMAGE_BYTES: u64 = 40 * 1024 * 1024;
    if response.content_length().is_some_and(|length| length > MAX_IMAGE_BYTES) {
        return Err("图片过大，无法嵌入".into());
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
        .map_err(|error| format!("图片读取失败：{error}"))?;
    if bytes.len() as u64 > MAX_IMAGE_BYTES {
        return Err("图片过大，无法嵌入".into());
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
    let builder = tauri::Builder::default().plugin(
        tauri_plugin_autostart::Builder::new()
            .app_name("v5notes")
            .build(),
    );

    #[cfg(any(target_os = "android", target_os = "ios"))]
    let builder = tauri::Builder::default();

    builder
        .invoke_handler(tauri::generate_handler![
            exit_app,
            open_project_link,
            open_external_url,
            export_pdf,
            fetch_image_data_url,
            autostart_is_supported,
            autostart_is_enabled,
            set_autostart_enabled
        ])
        .setup(|app| {
            let show = MenuItem::with_id(app, "show", "显示窗口", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "退出 v5notes", true, None::<&str>)?;
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
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("failed to start v5notes client");
}

#[cfg(test)]
mod tests {
    use super::openable_external_url;

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