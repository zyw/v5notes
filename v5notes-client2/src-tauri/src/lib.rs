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
    #[cfg(target_os = "macos")]
    let mut command = {
        let mut command = Command::new("open");
        command.arg(PROJECT_URL);
        command
    };

    #[cfg(target_os = "windows")]
    let mut command = {
        let mut command = Command::new("cmd");
        command.args(["/C", "start", "", PROJECT_URL]);
        command
    };

    #[cfg(all(unix, not(target_os = "macos")))]
    let mut command = {
        let mut command = Command::new("xdg-open");
        command.arg(PROJECT_URL);
        command
    };

    command
        .spawn()
        .map(|_| ())
        .map_err(|error| format!("无法打开项目主页：{error}"))
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
