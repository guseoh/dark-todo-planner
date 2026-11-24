import { invoke, isTauri } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useCallback, useEffect, useState } from "react";

import { beginMaintenance } from "../../lib/desktopSafety";
import { desktopUpdater, updateErrorMessage } from "../../lib/desktopUpdater";

export function DesktopAutoUpdate() {
  const [available, setAvailable] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const check = useCallback(async () => {
    setChecking(true);
    setDismissed(false);
    setError("");
    try {
      const status = await desktopUpdater.check();
      setAvailable(status.availableVersion);
    } catch {
      // Startup network failure should not block opening the app.
      setError("업데이트 확인에 실패했습니다. 설정에서 다시 시도할 수 있습니다.");
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    if (!isTauri()) return;
    void check();
    // An app can remain in the Windows tray for days. Discover new Releases
    // without requiring the user to restart Tern or open Settings.
    const interval = window.setInterval(() => void check(), 60 * 60 * 1000);
    let active = true;
    let stop: (() => void) | undefined;
    void listen("tern-check-update", () => void check()).then((unlisten) => {
      if (active) stop = unlisten;
      else unlisten();
    }).catch(() => { /* startup/hourly checks remain available */ });
    let stopQuit: (() => void) | undefined;
    void listen("tern-request-quit", async () => {
      let release: (() => void) | undefined;
      try {
        release = beginMaintenance();
        await invoke("desktop_quit");
      } catch (cause) {
        setDismissed(false);
        setError(updateErrorMessage(cause, "앱을 종료하지 못했습니다. 저장 상태를 확인해 주세요."));
      } finally { release?.(); }
    }).then(unlisten => { if (active) stopQuit = unlisten; else unlisten(); }).catch(() => {});
    const online = () => void check();
    window.addEventListener("online", online);
    return () => { active = false; window.clearInterval(interval); stop?.(); stopQuit?.(); window.removeEventListener("online", online); };
  }, [check]);

  const install = async () => {
    if (!available || installing || checking) return;
    setInstalling(true);
    setError("");
    try {
      await desktopUpdater.install(available);
      setAvailable(null);
    } catch (cause) {
      setError(updateErrorMessage(cause, "업데이트 설치에 실패했습니다. 잠시 후 다시 시도해 주세요."));
    } finally {
      setInstalling(false);
    }
  };

  if (!isTauri() || dismissed || (!available && !error)) return null;
  return (
    <aside className="fixed bottom-5 right-5 z-[100] max-w-sm border border-ui-divider bg-ui-elevated p-4 shadow-xl" role="status" aria-live="polite">
      <p className="font-semibold text-ui-text">{available ? "Tern 업데이트가 있습니다" : "Tern 업데이트"}</p>
      {available ? <p className="mt-1 text-sm text-ui-secondary">새 버전 {available}을 설치할 수 있습니다. 설치 시 앱이 종료되므로 작성 중인 내용을 먼저 저장해 주세요.</p> : null}
      {error ? <p className="mt-2 text-sm text-danger">{error}</p> : null}
      <div className="mt-3 flex gap-2">
        {available ? <button className="btn-primary" type="button" disabled={installing || checking} onClick={() => void install()}>{installing ? "설치 중…" : "업데이트 설치"}</button> : null}
        {error ? <button className="btn-secondary" type="button" disabled={checking || installing} onClick={() => void check()}>{checking ? "확인 중…" : "다시 확인"}</button> : null}
        <button className="btn-secondary" type="button" disabled={installing} onClick={() => setDismissed(true)}>나중에</button>
      </div>
    </aside>
  );
}
