use tauri::{
    menu::{Menu, MenuItem},
    tray::TrayIconBuilder,
    Emitter, Manager,
};

#[tauri::command]
fn exit_app(app: tauri::AppHandle) {
    app.exit(0);
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![exit_app])
        .setup(|app| {
            let show = MenuItem::with_id(app, "show", "显示窗口", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "退出 v5notes", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show, &quit])?;

            let tray = TrayIconBuilder::with_id("main-tray")
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
