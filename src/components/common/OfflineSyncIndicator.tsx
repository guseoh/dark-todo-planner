import { CloudOff, RefreshCw, TriangleAlert } from "lucide-react";
import { useEffect, useState } from "react";
import {
  getOfflineTodoQueueSummary,
  OFFLINE_TODO_QUEUE_CHANGED,
  requestOfflineTodoSync,
  retryFailedTodoMutations,
  type OfflineTodoQueueSummary,
} from "../../lib/offlineTodoQueue";

const emptySummary: OfflineTodoQueueSummary = { pending: 0, failed: 0, total: 0 };

export function OfflineSyncIndicator() {
  const [summary, setSummary] = useState<OfflineTodoQueueSummary>(emptySummary);
  const [online, setOnline] = useState(() => typeof navigator === "undefined" ? true : navigator.onLine);
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    let active = true;
    const refresh = () => {
      if (!active) return;
      setOnline(navigator.onLine);
      void getOfflineTodoQueueSummary().then((next) => { if (active) setSummary(next); });
    };
    const handleOnline = () => { refresh(); requestOfflineTodoSync(); };
    const handleOffline = () => refresh();
    refresh();
    window.addEventListener(OFFLINE_TODO_QUEUE_CHANGED, refresh);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      active = false;
      window.removeEventListener(OFFLINE_TODO_QUEUE_CHANGED, refresh);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  if (online && summary.total === 0) return null;

  const failed = summary.failed > 0;
  const message = failed
    ? `Todo 동기화 확인 필요 · 실패 ${summary.failed}개${summary.pending ? ` · 대기 ${summary.pending}개` : ""}`
    : online
      ? `Todo 변경 ${summary.pending}개 동기화 대기`
      : summary.pending > 0
        ? `오프라인 · Todo 변경 ${summary.pending}개 저장됨`
        : "오프라인 · Todo 변경은 연결 복구 후 동기화됩니다.";

  const retry = async () => {
    if (retrying) return;
    setRetrying(true);
    try {
      if (summary.failed > 0) await retryFailedTodoMutations();
      requestOfflineTodoSync();
    } finally {
      setRetrying(false);
    }
  };

  return (
    <div className="fixed bottom-20 left-4 z-[95] w-[min(26rem,calc(100vw-2rem))] rounded-lg border border-ink-600 bg-ink-900/96 px-3 py-2.5 shadow-2xl backdrop-blur-xl lg:bottom-4" role="status" aria-live="polite">
      <div className="flex items-start gap-2.5">
        {failed ? <TriangleAlert size={17} className="mt-0.5 shrink-0 text-amber-300" /> : <CloudOff size={17} className="mt-0.5 shrink-0 text-ink-300" />}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-ink-100">{message}</p>
          {failed && summary.firstError ? <p className="mt-1 break-words text-xs text-ink-400">{summary.firstError}</p> : null}
          {!online ? <p className="mt-1 text-xs text-ink-500">온라인으로 돌아오면 생성 순서대로 자동 동기화합니다.</p> : null}
        </div>
        {online && summary.total > 0 ? (
          <button type="button" className="btn-secondary shrink-0 px-2.5 text-xs" onClick={() => void retry()} disabled={retrying}>
            <RefreshCw size={14} />{retrying ? "재시도 중" : "다시 동기화"}
          </button>
        ) : null}
      </div>
    </div>
  );
}
