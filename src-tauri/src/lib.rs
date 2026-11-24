use reqwest::{Client, Method, Url, cookie::{Jar, CookieStore}};
use std::sync::Arc;
#[cfg(windows)]
mod session_vault;
#[cfg(windows)]
mod instance_signal;
use serde::Serialize;
use std::{sync::atomic::{AtomicBool, Ordering}, time::Duration};
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Emitter, Manager, State,
};
use tauri_plugin_updater::UpdaterExt;

const API_ORIGIN: &str = "https://dark-todo-planner.guseoh.workers.dev";

#[derive(Default)]
struct UpdateGate(AtomicBool);

struct UpdateLease<'a>(&'a AtomicBool);
impl Drop for UpdateLease<'_> {
    fn drop(&mut self) { self.0.store(false, Ordering::Release); }
}
impl UpdateGate {
    fn acquire(&self) -> Result<UpdateLease<'_>, String> {
        self.0.compare_exchange(false, true, Ordering::Acquire, Ordering::Relaxed)
            .map(|_| UpdateLease(&self.0))
            .map_err(|_| "다른 업데이트 작업이 진행 중입니다.".into())
    }
}

const SESSION_COOKIE: &str = "__Host-dtp_session";

struct ApiClient {
    client: Client,
    jar: Arc<Jar>,
}

fn session_token(jar: &Jar, url: &Url) -> Option<String> {
    let header = jar.cookies(url)?;
    header.to_str().ok()?.split(';').find_map(|part| {
        let (name, value) = part.trim().split_once('=')?;
        (name == SESSION_COOKIE).then(|| value.to_string())
    })
}

fn valid_token_shape(token: &str) -> bool {
    token.len() <= 512 && token.starts_with("v2.") && token.bytes().all(|b| b.is_ascii_alphanumeric() || matches!(b, b'.' | b'-' | b'_'))
}

fn restore_session(jar: &Jar) {
    #[cfg(windows)]
    match session_vault::read() {
        Ok(Some(token)) if valid_token_shape(&token) => {
            if let Ok(url) = Url::parse(API_ORIGIN) {
                jar.add_cookie_str(&format!("{SESSION_COOKIE}={token}; Path=/; Secure; HttpOnly; SameSite=Strict"), &url);
            }
        }
        Ok(_) => {}
        Err(_) => eprintln!("Tern session vault unavailable; sign in again."),
    }
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

fn trusted_api_url(path: &str) -> Result<Url, String> {
    // All requests have a fixed trusted host. A renderer cannot turn this into an
    // arbitrary HTTP proxy, or send session cookies to a different server.
    if !path.starts_with("/api/") || path.contains('\\') || path.contains('#') {
        return Err("허용되지 않은 API 경로입니다.".into());
    }
    let url = Url::parse(&format!("{API_ORIGIN}{path}")).map_err(|_| "잘못된 API 주소입니다.")?;
    if url.origin().ascii_serialization() != API_ORIGIN || !url.path().starts_with("/api/") {
        return Err("허용되지 않은 API 주소입니다.".into());
    }
    Ok(url)
}

#[tauri::command]
async fn desktop_api_request(
    state: State<'_, ApiClient>,
    path: String,
    method: String,
    body: Option<String>,
) -> Result<ApiResponse, String> {
    if cfg!(feature = "qa") { return Err("QA 빌드에서는 운영 API에 접근할 수 없습니다.".into()); }
    let url = trusted_api_url(&path)?;
    let method = Method::from_bytes(method.as_bytes()).map_err(|_| "잘못된 HTTP 메서드입니다.")?;
    if !matches!(method, Method::GET | Method::POST | Method::PUT | Method::PATCH | Method::DELETE) {
        return Err("허용되지 않은 HTTP 메서드입니다.".into());
    }
    if method == Method::GET && body.is_some() {
        return Err("GET 요청에는 본문을 전송할 수 없습니다.".into());
    }
    let auth_path = url.path().to_string();
    let previous_token = session_token(&state.jar, &url);
    #[cfg(windows)]
    if auth_path == "/api/auth/logout" || auth_path == "/api/auth/login" {
        session_vault::clear().map_err(|_| "Windows 세션 저장소를 정리하지 못했습니다. 다시 시도해 주세요.")?;
    }
    let mut request = state.client.request(method, url.clone()).header("Accept", "application/json");
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
    #[cfg(windows)]
    if auth_path == "/api/auth/login" && status == 200 {
        if let Some(token) = session_token(&state.jar, &url).filter(|token| valid_token_shape(token)) {
            if session_vault::write(&token).is_err() { eprintln!("Tern could not persist the session; sign-in remains valid until exit."); }
        }
    } else if auth_path == "/api/auth/session" && status == 401 && session_token(&state.jar, &url) == previous_token {
        if session_vault::clear().is_err() { eprintln!("Tern could not remove expired session from vault."); }
        state.jar.add_cookie_str(&format!("{SESSION_COOKIE}=; Path=/; Secure; Max-Age=0"), &url);
    }
    Ok(ApiResponse { status, body, content_type })
}

#[tauri::command]
async fn desktop_update(
    app: tauri::AppHandle,
    gate: State<'_, UpdateGate>,
    check_now: bool,
    install: bool,
    expected_version: Option<String>,
) -> Result<UpdateState, String> {
    let installed_version = app.package_info().version.to_string();
    if cfg!(feature = "qa") {
        if install { return Err("QA 빌드는 업데이트를 설치할 수 없습니다.".into()); }
        return Ok(UpdateState { installed_version, available_version: None });
    }
    if !check_now && !install {
        return Ok(UpdateState { installed_version, available_version: None });
    }
    let _lease = gate.acquire()?;
    if install && expected_version.as_deref().filter(|v| !v.is_empty()).is_none() {
        return Err("설치할 버전을 먼저 확인해 주세요.".into());
    }
    let updater = app.updater().map_err(|_| "업데이트 설정을 읽지 못했습니다.".to_string())?;
    let available = updater.check().await.map_err(|_| "업데이트 확인에 실패했습니다.".to_string())?;
    let Some(update) = available else {
        return Ok(UpdateState { installed_version, available_version: None });
    };
    let available_version = Some(update.version.clone());
    if install {
        if expected_version.as_deref() != Some(update.version.as_str()) {
            return Err("새 버전 정보가 변경되었습니다. 다시 확인한 후 설치해 주세요.".into());
        }
        // The Windows updater verifies the signature and exits this process to
        // hand control to the signed NSIS installer.
        update.download_and_install(|_, _| {}, || {}).await.map_err(|_| "업데이트 다운로드 또는 서명 검증·설치에 실패했습니다.".to_string())?;
        // Tauri recommends restarting the app after the signed update installs.
        app.restart();
    }
    Ok(UpdateState { installed_version, available_version })
}

fn trusted_github_link(value: &str) -> Result<Url, String> {
    let url = Url::parse(value).map_err(|_| "잘못된 GitHub 주소입니다.")?;
    let parts: Vec<_> = url.path().trim_matches('/').split('/').collect();
    let segment_ok = |part: &str| !part.is_empty() && part != "." && part != ".." && part.bytes().all(|ch| ch.is_ascii_alphanumeric() || matches!(ch, b'-' | b'_' | b'.'));
    if url.origin().ascii_serialization() != "https://github.com" || !url.username().is_empty() || url.password().is_some() || url.query().is_some() || url.fragment().is_some()
        || parts.len() != 4 || !segment_ok(parts[0]) || !segment_ok(parts[1]) || !matches!(parts[2], "issues" | "pull") || parts[3].is_empty() || !parts[3].bytes().all(|ch| ch.is_ascii_digit()) {
        return Err("허용되지 않은 GitHub 주소입니다.".into());
    }
    Ok(url)
}

#[tauri::command]
fn desktop_open_github(url: String) -> Result<(), String> {
    if cfg!(feature = "qa") { return Err("QA 빌드에서는 외부 브라우저를 열지 않습니다.".into()); }
    let url = trusted_github_link(&url)?;
    #[cfg(windows)]
    {
        // Pass the URL as one argument, never interpolate it into a shell command.
        let explorer = std::env::var_os("WINDIR").map(std::path::PathBuf::from).ok_or("Windows 경로를 확인하지 못했습니다.")?.join("explorer.exe");
        std::process::Command::new(explorer).arg(url.as_str()).spawn().map_err(|_| "브라우저를 열지 못했습니다.".to_string())?;
        Ok(())
    }
    #[cfg(not(windows))]
    { let _ = url; Err("Windows 전용 기능입니다.".into()) }
}

#[tauri::command]
fn desktop_quit(app: tauri::AppHandle, gate: State<'_, UpdateGate>) -> Result<(), String> {
    let _lease = gate.acquire()?;
    app.exit(0);
    Ok(())
}

#[cfg(windows)]
fn acquire_instance(directory: &std::path::Path) -> std::io::Result<Option<std::fs::File>> {
    std::fs::create_dir_all(directory)?;
    let lock = std::fs::OpenOptions::new()
        .read(true).write(true).create(true).truncate(false)
        .open(directory.join("tern-instance.lock"))?;
    match lock.try_lock() {
        Ok(()) => Ok(Some(lock)),
        Err(std::fs::TryLockError::WouldBlock) => Ok(None),
        Err(std::fs::TryLockError::Error(error)) => Err(error),
    }
}

fn show_main_window(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }
}

// Take the OS-backed lock before Tauri, WebView2, or session restoration can start.
pub fn run() {
    #[cfg(windows)]
    let _instance = {
        let directory = std::env::var_os("LOCALAPPDATA").map(std::path::PathBuf::from)
            .expect("Windows local application data directory unavailable")
            .join(if cfg!(feature = "qa") { "io.github.guseoh.dark-todo-planner.qa" } else { "io.github.guseoh.dark-todo-planner" });
        match acquire_instance(&directory) {
            Ok(Some(lock)) => lock,
            Ok(None) => {
                // Bring the running (possibly tray-hidden) window forward instead of doing nothing.
                instance_signal::notify_running_instance(cfg!(feature = "qa"));
                return;
            }
            Err(error) => panic!("failed to acquire Tern instance lock: {error}"),
        }
    };
    #[cfg(windows)]
    let show_signal = instance_signal::ShowSignal::create(cfg!(feature = "qa"));
    let jar = Arc::new(Jar::default());
    if !cfg!(feature = "qa") { restore_session(&jar); }
    let client = Client::builder()
        .cookie_provider(jar.clone())
        .timeout(Duration::from_secs(35))
        .redirect(reqwest::redirect::Policy::none())
        .build()
        .expect("failed to construct native API client");

    tauri::Builder::default()
        .on_window_event(|window, event| {
            if cfg!(feature = "qa") { return; }
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .manage(ApiClient { client, jar })
        .manage(UpdateGate::default())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![desktop_api_request, desktop_update, desktop_quit, desktop_open_github])
        .setup(move |app| {
            #[cfg(windows)]
            if let Some(signal) = show_signal {
                let handle = app.handle().clone();
                std::thread::spawn(move || {
                    while signal.wait() { show_main_window(&handle); }
                });
            }
            // No global shortcuts or shared system tray actions in QA.
            if cfg!(feature = "qa") { return Ok(()); }
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
            // Windows convention: left click opens the app, right click shows the menu.
            let mut tray = TrayIconBuilder::new().menu(&menu).tooltip("Tern")
                .show_menu_on_left_click(false)
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click { button: MouseButton::Left, button_state: MouseButtonState::Up, .. } = event {
                        show_main_window(tray.app_handle());
                    }
                })
                .on_menu_event(|app, event| {
                match event.id().as_ref() {
                    "open" => show_main_window(app),
                    "check" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                            let _ = window.emit("tern-check-update", ());
                        }
                    }
                    "quit" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                            let _ = window.emit("tern-request-quit", ());
                        }
                    },
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

#[cfg(test)]
mod tests {
    use super::*;
    #[cfg(windows)]
    #[test]
    fn instance_lock_rejects_second_handle_and_reopens_after_release() {
        let directory = std::env::temp_dir().join(format!("tern-lock-test-{}-{}", std::process::id(), std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_nanos()));
        let first = acquire_instance(&directory).unwrap().unwrap();
        assert!(acquire_instance(&directory).unwrap().is_none());
        drop(first);
        assert!(acquire_instance(&directory).unwrap().is_some());
        std::fs::remove_dir_all(directory).unwrap();
    }

    #[test]
    fn rejects_invalid_session_cookie_shapes() {
        assert!(valid_token_shape("v2.1.2.abc.def"));
        assert!(!valid_token_shape("v2.1; other=secret"));
        assert!(!valid_token_shape("v2.1\n"));
    }

    #[test]
    fn native_api_rejects_external_and_escaped_paths() {
        assert_eq!(trusted_api_url("/api/todos?limit=100").unwrap().origin().ascii_serialization(), API_ORIGIN);
        for path in ["https://example.com/api/todos", "//example.com/api/todos", "/api/../secret", "/api/%2e%2e/secret", "/api/\\secret", "/api/todos#secret"] {
            assert!(trusted_api_url(path).is_err(), "accepted {path}");
        }
    }

    #[test]
    fn update_gate_releases_on_drop_and_rejects_concurrent_work() {
        let gate = UpdateGate::default();
        let lease = gate.acquire().unwrap();
        assert!(gate.acquire().is_err());
        drop(lease);
        assert!(gate.acquire().is_ok());
    }
}

#[cfg(test)]
mod github_link_tests {
    use super::*;
    #[test]
    fn only_canonical_github_item_urls() {
        assert!(trusted_github_link("https://github.com/owner/repo/pull/12").is_ok());
        assert!(trusted_github_link("https://github.com/owner/repo/issues/3").is_ok());
        for value in ["http://github.com/o/r/pull/1", "https://evil.example/o/r/pull/1", "https://github.com@evil.example/o/r/pull/1", "https://user@github.com/o/r/pull/1", "https://github.com/o/r/pull/1?x=1", "https://github.com/o/r/pull/%31", "file:///C:/Windows"] {
            assert!(trusted_github_link(value).is_err());
        }
    }
}
