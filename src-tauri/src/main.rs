#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod updates;

use tauri::{
    menu::{Menu, MenuItem},
    tray::TrayIconBuilder,
    webview::NewWindowResponse,
    App, AppHandle, Manager, WebviewUrl, WebviewWindow, WebviewWindowBuilder, WindowEvent,
};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};
use tauri_plugin_opener::OpenerExt;

const MAIN_WINDOW: &str = "main";
const APP_NAME: &str = "Tern";
// Tauri classifies build.frontendDist as local IPC. Keep the hosted page external.
const PLANNER_ORIGIN: &str = "https://dark-todo-planner.guseoh.workers.dev";
// Reuse the deployed React keyboard handler, even before another web release.
const QUICK_ADD_SCRIPT: &str = r#"
    window.dispatchEvent(new KeyboardEvent("keydown", {
        key: "K", code: "KeyK", ctrlKey: true, shiftKey: true,
        bubbles: true, cancelable: true
    }));
"#;

fn show_main_window(app: &AppHandle) -> tauri::Result<Option<WebviewWindow>> {
    let Some(window) = app.get_webview_window(MAIN_WINDOW) else {
        return Ok(None);
    };
    window.unminimize()?;
    window.show()?;
    window.set_focus()?;
    Ok(Some(window))
}

fn open_quick_add(app: &AppHandle) -> tauri::Result<()> {
    if let Some(window) = show_main_window(app)? {
        if window.url()?.origin().ascii_serialization() == PLANNER_ORIGIN {
            window.eval(QUICK_ADD_SCRIPT)?;
        }
    }
    Ok(())
}

fn create_main_window(app: &App) -> Result<(), Box<dyn std::error::Error>> {
    let app_handle = app.handle().clone();
    let window = WebviewWindowBuilder::new(
        app,
        MAIN_WINDOW,
        WebviewUrl::External(PLANNER_ORIGIN.parse()?),
    )
    .title(APP_NAME)
    .inner_size(1100.0, 800.0)
    .min_inner_size(480.0, 520.0)
    .on_navigation(|url| url.origin().ascii_serialization() == PLANNER_ORIGIN)
    .on_new_window(move |url, _| {
        if matches!(url.scheme(), "http" | "https") {
            if let Err(error) = app_handle.opener().open_url(url.as_str(), None::<&str>) {
                eprintln!("Could not open a link in the default browser: {error}");
            }
        }
        NewWindowResponse::Deny
    })
    .build()?;

    let main_window = window.clone();
    window.on_window_event(move |event| {
        if let WindowEvent::CloseRequested { api, .. } = event {
            match main_window.hide() {
                Ok(()) => api.prevent_close(),
                Err(error) => eprintln!("Could not hide the Planner window: {error}"),
            }
        }
    });
    Ok(())
}

fn create_tray(app: &App, shortcut_available: bool) -> Result<(), Box<dyn std::error::Error>> {
    let show = MenuItem::with_id(app, "show", "앱 열기", true, None::<&str>)?;
    let hide = MenuItem::with_id(app, "hide", "창 숨기기", true, None::<&str>)?;
    let check_update = MenuItem::with_id(app, "check-update", "업데이트 확인", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "종료", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&show, &hide, &check_update, &quit])?;
    let tooltip = if shortcut_available {
        APP_NAME
    } else {
        "Tern · Ctrl+Shift+K 등록 실패"
    };
    let icon = app.default_window_icon().ok_or("Missing desktop icon.")?;

    TrayIconBuilder::new()
        .icon(icon.clone())
        .tooltip(tooltip)
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| {
            let result = match event.id().as_ref() {
                "show" => show_main_window(app).map(|_| ()),
                "hide" => app
                    .get_webview_window(MAIN_WINDOW)
                    .map_or(Ok(()), |window| window.hide()),
                "check-update" => {
                    updates::start_check(app, true);
                    Ok(())
                }
                "quit" => {
                    app.exit(0);
                    Ok(())
                }
                _ => Ok(()),
            };
            if let Err(error) = result {
                eprintln!("Could not perform a Planner tray action: {error}");
            }
        })
        .build(app)?;
    Ok(())
}

fn main() {
    let quick_add = Shortcut::new(Some(Modifiers::CONTROL | Modifiers::SHIFT), Code::KeyK);

    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _, _| {
            if let Err(error) = show_main_window(app) {
                eprintln!("Could not restore Tern: {error}");
            }
        }))
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .manage(updates::UpdateCheck::default())
        .invoke_handler(tauri::generate_handler![updates::desktop_update])
        .plugin(
            tauri_plugin_opener::Builder::new()
                .open_js_links_on_click(false)
                .build(),
        )
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(move |app, shortcut, event| {
                    if shortcut == &quick_add && event.state() == ShortcutState::Pressed {
                        if let Err(error) = open_quick_add(app) {
                            eprintln!("Could not open quick Todo input: {error}");
                        }
                    }
                })
                .build(),
        )
        .setup(move |app| {
            let registration = app.global_shortcut().register(quick_add);
            if let Err(error) = &registration {
                eprintln!("Could not register Ctrl+Shift+K: {error}");
            }
            create_tray(app, registration.is_ok())?;
            create_main_window(app)?;
            updates::start_check(app.handle(), false);
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("Could not start Tern.");
}
