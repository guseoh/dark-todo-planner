import { invoke } from "@tauri-apps/api/core";
import { RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";

export function DesktopUpdateCard() {
  const [version, setVersion] = useState<string | null>();
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    void invoke<string>("desktop_update", { checkNow: false }).then(
      (installedVersion) => { if (active) setVersion(installedVersion); },
      () => { if (active) setVersion(null); },
    );
    return () => { active = false; };
  }, []);

  const checkForUpdate = async () => {
    setChecking(true);
    setError("");
    try {
      await invoke<string>("desktop_update", { checkNow: true });
    } catch {
      setError("업데이트 확인을 시작할 수 없습니다. 트레이 메뉴에서 다시 시도하세요.");
    } finally {
      setChecking(false);
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
              <p className="mt-1 text-xs text-ui-muted">앱을 시작할 때 새 버전을 확인합니다.</p>
            </>
          ) : (
            <p className="mt-1 text-sm text-ui-secondary" role="status">
              {version === null ? "이 버전에서는 트레이 메뉴에서 업데이트를 확인할 수 있습니다." : "설치된 버전 확인 중…"}
            </p>
          )}
        </div>
        {version ? (
          <button type="button" className="btn-secondary shrink-0 self-start" disabled={checking}
            onClick={() => void checkForUpdate()}>
            <RefreshCw size={15} aria-hidden="true" />{checking ? "확인 중…" : "업데이트 확인"}
          </button>
        ) : null}
      </div>
      {error ? <p className="mt-3 text-sm text-danger" role="alert">{error}</p> : null}
    </section>
  );
}
