import { useState, type ChangeEvent } from "react";
import { Download, FileUp, ShieldAlert } from "lucide-react";
import { useBackup } from "../../hooks/useBackup";
import { validateRestorableBackup, type BackupRestorePreview } from "../../lib/backupRestore";

const MAX_BACKUP_FILE_BYTES = 15 * 1024 * 1024;

export function BackupRestoreCard({ onRestored }: { onRestored: () => Promise<void> }) {
  const { exportBackup, importBackup } = useBackup(onRestored);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<BackupRestorePreview | null>(null);
  const [confirmedText, setConfirmedText] = useState("");
  const [safetyBackupDownloaded, setSafetyBackupDownloaded] = useState(false);

  const download = async () => {
    if (busy) return;
    setBusy(true);
    setError("");
    setMessage("");
    setSafetyBackupDownloaded(false);
    try {
      const data = await exportBackup();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      try {
        const link = document.createElement("a");
        link.href = url;
        link.download = `dark-todo-planner-backup-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
        document.body.appendChild(link);
        link.click();
        link.remove();
      } finally {
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
      // Always allow downloading the raw export for safekeeping, but never
      // represent a malformed snapshot as safe to use for replacement.
      try {
        validateRestorableBackup(data);
        setSafetyBackupDownloaded(true);
        setMessage("JSON 백업 다운로드를 요청했습니다. 파일이 실제 저장됐는지 확인해주세요.");
      } catch (validationError) {
        setError(validationError instanceof Error
          ? `JSON 파일은 다운로드했지만 이 파일로 전체 복원할 수 없습니다: ${validationError.message}. D1 SQL 백업을 사용하세요.`
          : "JSON 내보내기 검증에 실패했습니다. D1 SQL 백업을 사용하세요.");
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "백업 생성에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  };

  const inspect = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    setPreview(null);
    setConfirmedText("");
    setMessage("");
    setError("");
    if (!file) return;
    if (file.size > MAX_BACKUP_FILE_BYTES) {
      setError("15MB를 넘는 백업은 이 화면에서 복원할 수 없습니다.");
      return;
    }
    try {
      const parsed: unknown = JSON.parse(await file.text());
      setPreview(validateRestorableBackup(parsed));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "백업 파일을 읽을 수 없습니다.");
    }
  };

  const restore = async () => {
    if (busy || !preview || !safetyBackupDownloaded || confirmedText !== "복원") return;
    if (!window.confirm("현재 서버 데이터가 선택한 백업으로 대체됩니다. 이 작업은 실행 취소할 수 없습니다. 계속할까요?")) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await importBackup(preview.payload);
      setPreview(null);
      setConfirmedText("");
      setSafetyBackupDownloaded(false);
      setMessage("백업을 복원했습니다. 데이터를 다시 불러왔습니다.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "백업 복원 중 오류가 발생했습니다. 현재 데이터 상태를 먼저 확인해주세요.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="app-card space-y-4 p-4 sm:p-5" aria-labelledby="backup-restore-title">
      <div>
        <h3 id="backup-restore-title" className="flex items-center gap-2 text-base font-bold text-ink-100"><ShieldAlert size={18} className="text-accent-300" />전체 데이터 백업·복원</h3>
        <p className="mt-1 text-xs leading-5 text-ink-400">JSON 백업은 Todo뿐 아니라 프로젝트, 메모, 설정 등 서버 데이터를 복구하기 위한 파일입니다. Markdown/CSV 읽기용 내보내기와 구분됩니다.</p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className="btn-primary" onClick={() => void download()} disabled={busy}><Download size={15} />전체 JSON 백업 다운로드</button>
        <label className="btn-secondary cursor-pointer">
          <FileUp size={15} />복원 파일 선택
          <input type="file" accept=".json,application/json" className="sr-only" onChange={(event) => void inspect(event)} disabled={busy} />
        </label>
      </div>

      {preview ? (
        <div className="space-y-3 rounded-lg border border-warning/35 bg-warning/[0.04] p-3">
          <p className="text-sm font-semibold text-ink-100">백업 v{preview.version} · {new Date(preview.exportedAt).toLocaleString("ko-KR")}</p>
          <p className="text-xs text-ink-300">Todo {preview.counts.todos}개 · 카테고리 {preview.counts.categories}개 · 프로젝트 {preview.counts.projects}개 · 메모 {preview.counts.memos}개</p>
          <p className="text-xs leading-5 text-amber-200">주의: 복원은 병합이 아니라 현재 서버 데이터를 대체합니다. 필수 목록 {preview.collectionCount}개 및 항목 참조를 검사했지만, 복원은 여러 DB 단계로 실행되어 중간 실패 시 일부만 반영될 수 있습니다. 최신 D1 SQL 백업과 JSON 백업을 별도로 확보하세요.</p>
          <label className="block text-xs font-semibold text-ink-300">복원을 진행하려면 아래에 복원을 입력하세요.
            <input className="field mt-2" autoComplete="off" value={confirmedText} onChange={(event) => setConfirmedText(event.target.value)} placeholder="복원" disabled={busy} />
          </label>
          <button type="button" className="btn-danger" onClick={() => void restore()} disabled={busy || !safetyBackupDownloaded || confirmedText !== "복원"}>
            {busy ? "복원 중..." : "현재 데이터 대체 및 복원"}
          </button>
          {!safetyBackupDownloaded ? <p className="text-xs text-ink-500">데이터 보호를 위해 현재 세션에서 전체 JSON 백업 다운로드가 먼저 필요합니다.</p> : null}
        </div>
      ) : null}
      {message ? <p className="text-xs font-semibold text-emerald-200" role="status">{message}</p> : null}
      {error ? <p className="text-xs font-semibold text-red-200" role="alert">{error}</p> : null}
    </section>
  );
}
