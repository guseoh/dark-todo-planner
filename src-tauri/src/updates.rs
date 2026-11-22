use std::time::Duration;

use tauri::{async_runtime, AppHandle, Manager};
use tauri_plugin_dialog::{DialogExt, MessageDialogButtons};
use tauri_plugin_updater::{Error, UpdaterExt};

#[derive(Default)]
pub struct UpdateCheck(async_runtime::Mutex<()>);

pub fn start_check(app: &AppHandle, manual: bool) {
    let app = app.clone();
    async_runtime::spawn(async move {
        let result = check(&app).await;
        if manual {
            if let Ok(Some(message)) | Err(message) = result {
                app.dialog()
                    .message(message)
                    .title("Tern 업데이트")
                    .buttons(MessageDialogButtons::OkCustom("확인".into()))
                    .show(|_| {});
            }
        }
    });
}

#[tauri::command]
pub async fn desktop_update(app: AppHandle, check_now: bool) -> Result<String, String> {
    if !check_now {
        return Ok(app.package_info().version.to_string());
    }

    check(&app)
        .await
        .map(|message| message.unwrap_or_else(|| "업데이트를 나중에 설치합니다.".into()))
}

async fn check(app: &AppHandle) -> Result<Option<String>, String> {
    let state = app.state::<UpdateCheck>();
    let _checking = state
        .0
        .try_lock()
        .map_err(|_| "이미 업데이트를 확인하고 있습니다.".to_string())?;
    let updater = app
        .updater_builder()
        .timeout(Duration::from_secs(60))
        .build()
        .map_err(check_error)?;
    let Some(update) = updater.check().await.map_err(check_error)? else {
        return Ok(Some(format!(
            "Tern {}은 최신 버전입니다.",
            app.package_info().version
        )));
    };

    let dialog = app
        .dialog()
        .message(format!(
            "Tern {} 업데이트가 있습니다. 작업을 저장한 후 설치를 선택하면 앱이 다시 시작됩니다.",
            update.version
        ))
        .title("Tern 업데이트")
        .buttons(MessageDialogButtons::OkCancelCustom(
            "설치 후 다시 시작".into(),
            "나중에".into(),
        ));
    let accepted = async_runtime::spawn_blocking(move || dialog.blocking_show())
        .await
        .map_err(|_| "설치 확인창을 열 수 없습니다.".to_string())?;
    if !accepted {
        return Ok(None);
    }

    update
        .download_and_install(|_, _| {}, || {})
        .await
        .map_err(|error| {
            eprintln!("Tern update installation failed: {error}");
            "업데이트를 설치하지 못했습니다. 잠시 후 다시 시도해주세요.".to_string()
        })?;
    Ok(Some("업데이트를 설치했습니다.".into()))
}

fn check_error(error: Error) -> String {
    eprintln!("Tern update check failed: {error}");
    match error {
        Error::ReleaseNotFound => "공개된 업데이트 정보를 찾을 수 없습니다.".into(),
        _ => "업데이트를 확인하지 못했습니다. 연결을 확인한 후 다시 시도해주세요.".into(),
    }
}
