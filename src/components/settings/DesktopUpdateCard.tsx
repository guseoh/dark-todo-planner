import { invoke } from "@tauri-apps/api/core";
import { RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";

type UpdateState = { installedVersion: string; availableVersion: string | null };

export function DesktopUpdateCard() {
  const [version, setVersion] = useState<string | null>();
  const [available, setAvailable] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    void invoke<UpdateState>("desktop_update", { checkNow: false, install: false }).then(
      (state) => { if (active) setVersion(state.installedVersion); },
      () => { if (active) setVersion(null); },
    );
    return () => { active = false; };
  }, []);

  const checkForUpdate = async () => {
    setChecking(true);
    setError("");
    try {
      const result = await invoke<UpdateState>("desktop_update", { checkNow: true, install: false });
      setAvailable(result.availableVersion);
      if (!result.availableVersion) setError("현재 최신 버전입니다.");
    } catch {
      setError("업데이트 확인에 실패했습니다. 네트워크 상태를 확인해 주세요.");
    } finally {
      setChecking(false);
    }
  };

  const installUpdate = async () => {
    setInstalling(true);
    setError("");
    try {
      await invoke<UpdateState>("desktop_update", { checkNow: true, install: true });
      setAvailable(null);
    } catch {
      setError("업데이트 설치에 실패했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setInstalling(false);
    }
  };

  return (
    <section className="app-card p-4 sm:p-5" aria-labelledby="desktop-update-title">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h3 id="desktop-update-title" className="text-base font-semibold text-ui-text">Tern 업데이트</h3>
          {version ? (
            <>
              <p className="mt-1 text-sm text-ui-secondary">설치된 버전 {version}</p>
              <p className="mt-1 text-xs text-ui-muted">앱을 시작할 때 새 버전을 자동으로 확인합니다.</p>
            </>
          ) : (
            <p className="mt-1 text-sm text-ui-secondary" role="status">
              {version === null ? "설치된 Tern 버전을 읽을 수 없습니다." : "설치된 버전 확인 중…"}
            </p>
          )}
          {available ? <p className="mt-2 text-sm text-ui-text">새 버전 {available}이 있습니다. 작성 중인 내용을 저장한 후 설치해 주세요.</p> : null}
        </div>
        <div className="flex shrink-0 gap-2 self-start">
          {available ? <button type="button" className="btn-primary" disabled={installing} onClick={() => void installUpdate()}>{installing ? "설치 중…" : "업데이트 설치"}</button> : null}
          {version ? <button type="button" className="btn-secondary" disabled={checking || installing} onClick={() => void checkForUpdate()}>
            <RefreshCw size={15} aria-hidden="true" />{checking ? "확인 중…" : "업데이트 확인"}
          </button> : null}
        </div>
      </div>
      {error ? <p className="mt-3 text-sm text-ui-secondary" role="status">{error}</p> : null}
    </section>
  );
}
