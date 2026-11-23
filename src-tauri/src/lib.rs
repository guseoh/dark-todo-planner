use reqwest::{Client, Method, Url};
use serde::Serialize;
use std::time::Duration;
use tauri::{
    menu::{Menu, MenuItem},
    tray::TrayIconBuilder,
    Emitter, Manager, State,
};
use tauri_plugin_updater::UpdaterExt;

const API_ORIGIN: &str = "https://dark-todo-planner.guseoh.workers.dev";

struct ApiClient {
    client: Client,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ApiResponse {
    status: u16,
    body: String,
    content_type: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct UpdateState {
    installed_version: String,
    available_version: Option<String>,
}

#[tauri::command]
async fn desktop_api_request(
    state: State<'_, ApiClient>,
    path: String,
    method: String,
    body: Option<String>,
) -> Result<ApiResponse, String> {
    // All requests have a fixed trusted host. A renderer cannot turn this into an
    // arbitrary HTTP proxy, or send session cookies to a different server.
    if !path.starts_with("/api/") || path.contains('\\') || path.contains('#') {
        return Err("허용되지 않은 API 경로입니다.".into());
    }
    let url = Url::parse(&format!("{API_ORIGIN}{path}")).map_err(|_| "잘못된 API 주소입니다.")?;
    if url.origin().ascii_serialization() != API_ORIGIN || !url.path().starts_with("/api/") {
        return Err("허용되지 않은 API 주소입니다.".into());
    }
    let method = Method::from_bytes(method.as_bytes()).map_err(|_| "잘못된 HTTP 메서드입니다.")?;
    if !matches!(method, Method::GET | Method::POST | Method::PUT | Method::PATCH | Method::DELETE) {
        return Err("허용되지 않은 HTTP 메서드입니다.".into());
    }
    if method == Method::GET && body.is_some() {
        return Err("GET 요청에는 본문을 전송할 수 없습니다.".into());
    }
    let mut request = state.client.request(method, url).header("Accept", "application/json");
    if let Some(body) = body {
        request = request.header("Content-Type", "application/json").body(body);
    }
    let response = request.send().await.map_err(|_| "API 서버 연결에 실패했습니다.".to_string())?;
    let status = response.status().as_u16();
    let content_type = response
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|value| value.to_str().ok())
        .unwrap_or("application/json")
        .to_string();
    let body = response.text().await.map_err(|_| "API 응답을 읽지 못했습니다.".to_string())?;
    Ok(ApiResponse { status, body, content_type })
}

#[tauri::command]
async fn desktop_update(
    app: tauri::AppHandle,
    check_now: bool,
    install: bool,
) -> Result<UpdateState, String> {
    let installed_version = app.package_info().version.to_string();
    if !check_now && !install {
        return Ok(UpdateState { installed_version, available_version: None });
    }
    let updater = app.updater().map_err(|error| error.to_string())?;
    let available = updater.check().await.map_err(|error| error.to_string())?;
    let Some(update) = available else {
        return Ok(UpdateState { installed_version, available_version: None });
    };
    let available_version = Some(update.version.clone());
    if install {
        // The Windows updater verifies the signature and exits this process to
        // hand control to the signed NSIS installer.
        update.download_and_install(|_, _| {}, || {}).await.map_err(|error| error.to_string())?;
    }
    Ok(UpdateState { installed_version, available_version })
}

pub fn run() {
    let client = Client::builder()
        .cookie_store(true)
        .timeout(Duration::from_secs(35))
        .redirect(reqwest::redirect::Policy::none())
        .build()
        .expect("failed to construct native API client");

    tauri::Builder::default()
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .manage(ApiClient { client })
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![desktop_api_request, desktop_update])
        .setup(|app| {
            use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};
            let quick_add = Shortcut::new(Some(Modifiers::CONTROL | Modifiers::SHIFT), Code::KeyK);
            app.handle().plugin(
                tauri_plugin_global_shortcut::Builder::new()
                    .with_handler(move |app, shortcut, event| {
                        if shortcut == &quick_add && event.state() == ShortcutState::Pressed {
                            if let Some(window) = app.get_webview_window("main") {
                                let _ = window.show();
                                let _ = window.set_focus();
                                let _ = window.emit("tern-open-quick-add", ());
                            }
                        }
                    })
                    .build(),
            )?;
            // A conflicting OS/app shortcut must not prevent Tern from starting.
            if let Err(error) = app.global_shortcut().register(quick_add) {
                eprintln!("Tern quick-add shortcut is unavailable: {error}");
            }
            let open = MenuItem::with_id(app, "open", "Tern 열기", true, None::<&str>)?;
            let check = MenuItem::with_id(app, "check", "업데이트 확인", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "종료", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&open, &check, &quit])?;
            let mut tray = TrayIconBuilder::new().menu(&menu).on_menu_event(|app, event| {
                match event.id().as_ref() {
                    "open" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                    "check" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                            let _ = window.emit("tern-check-update", ());
                        }
                    }
                    "quit" => app.exit(0),
                    _ => {}
                }
            });
            if let Some(icon) = app.default_window_icon() {
                tray = tray.icon(icon.clone());
            }
            tray.build(app)?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running Tern");
}
