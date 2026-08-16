import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, RotateCcw, SearchCheck, Trash2 } from "lucide-react";
import { EmptyState } from "../components/common/EmptyState";
import { Modal } from "../components/common/Modal";
import { api } from "../lib/api/client";
import type { TodoRestorePreview, TodoTrashEntry } from "../types/trash";

const refLabel = (ref: { requested: string | null; restored: string | null }) => {
  if (!ref.requested) return "연결 없음";
  return ref.restored ? "기존 연결 복원" : "연결 해제 후 복원";
};

const countLabel = (value: { requested: number; restored: number }) =>
  value.requested ? `${value.restored}/${value.requested}개 복원` : "연결 없음";

export function TrashPage({ onRestored }: { onRestored: () => Promise<void> }) {
  const [items, setItems] = useState<TodoTrashEntry[]>([]);
  const [preview, setPreview] = useState<TodoRestorePreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");

  const loadTrash = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api<{ trashTodos: TodoTrashEntry[] }>("/api/trash/todos");
      setItems(result.trashTodos);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "휴지통을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadTrash(); }, [loadTrash]);

  const openPreview = async (id: string) => {
    setWorking(true);
    try {
      const result = await api<{ preview: TodoRestorePreview }>(`/api/trash/todos/${id}/preview`);
      setPreview(result.preview);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "복원 상태를 확인하지 못했습니다.");
    } finally {
      setWorking(false);
    }
  };

  const restore = async () => {
    if (!preview?.restorable) return;
    setWorking(true);
    try {
      await api(`/api/trash/todos/${preview.id}/restore`, { method: "POST" });
      setPreview(null);
      await Promise.all([loadTrash(), onRestored()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Todo를 복원하지 못했습니다.");
    } finally {
      setWorking(false);
    }
  };

  const removePermanently = async (item: TodoTrashEntry) => {
    if (!window.confirm(`“${item.title}”을(를) 영구 삭제할까요? 이 작업은 되돌릴 수 없습니다.`)) return;
    setWorking(true);
    try {
      await api(`/api/trash/todos/${item.id}`, { method: "DELETE" });
      setItems((current) => current.filter((entry) => entry.id !== item.id));
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "휴지통 항목을 삭제하지 못했습니다.");
    } finally {
      setWorking(false);
    }
  };

  const emptyTrash = async () => {
    if (!items.length || !window.confirm(`휴지통의 Todo ${items.length}개를 모두 영구 삭제할까요? 이 작업은 되돌릴 수 없습니다.`)) return;
    setWorking(true);
    try {
      await api("/api/trash/todos", { method: "DELETE" });
      setItems([]);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "휴지통을 비우지 못했습니다.");
    } finally {
      setWorking(false);
    }
  };

  return (
    <div className="space-y-5">
      <section className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-ink-100 sm:text-3xl">휴지통</h2>
          <p className="mt-2 text-sm text-ink-400">삭제된 Todo를 복원하기 전에 어떤 연결이 돌아오는지 미리 확인합니다.</p>
        </div>
        <button type="button" className="btn-secondary min-h-10" onClick={() => void emptyTrash()} disabled={!items.length || working}>
          <Trash2 size={16} />
          휴지통 비우기
        </button>
      </section>

      {error ? <div className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-red-100" role="alert">{error}</div> : null}

      {loading ? <div className="app-card p-8 text-center text-sm text-ink-500">휴지통을 불러오는 중...</div> : items.length ? (
        <section className="app-card divide-y divide-ink-800 overflow-hidden">
          {items.map((item) => (
            <div key={item.id} className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-ink-100">{item.title}</p>
                <p className="mt-1 text-xs text-ink-500">삭제 {new Date(item.deletedAt).toLocaleString("ko-KR")}</p>
              </div>
              <div className="flex gap-2">
                <button type="button" className="btn-secondary min-h-9 px-3 py-1 text-xs" onClick={() => void openPreview(item.id)} disabled={working}>
                  <SearchCheck size={14} />
                  복원 검토
                </button>
                <button type="button" className="btn-secondary min-h-9 px-3 py-1 text-xs hover:border-danger hover:text-red-100" onClick={() => void removePermanently(item)} disabled={working}>
                  <Trash2 size={14} />
                  영구 삭제
                </button>
              </div>
            </div>
          ))}
        </section>
      ) : <EmptyState title="휴지통이 비어 있습니다." description="삭제 후 실행 취소 시간이 지나면 Todo가 이곳으로 이동합니다." />}

      {preview ? (
        <Modal title="Todo 복원 미리보기" description="현재 데이터 상태를 기준으로 실제 복원 가능한 연결만 보여줍니다." onClose={() => setPreview(null)} size="lg">
          <div className="space-y-4">
            <div className="rounded-lg border border-ink-700 bg-ink-950/45 p-3">
              <p className="font-bold text-ink-100">{preview.title}</p>
              <p className="mt-1 text-xs text-ink-500">원본 Todo ID: {preview.originalTodoId}</p>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <div className="rounded-lg bg-ink-950/35 p-3"><p className="text-xs font-semibold text-ink-500">카테고리</p><p className="mt-1 text-sm text-ink-200">{refLabel(preview.refs.category)}</p></div>
              <div className="rounded-lg bg-ink-950/35 p-3"><p className="text-xs font-semibold text-ink-500">프로젝트</p><p className="mt-1 text-sm text-ink-200">{refLabel(preview.refs.project)}</p></div>
              <div className="rounded-lg bg-ink-950/35 p-3"><p className="text-xs font-semibold text-ink-500">마일스톤</p><p className="mt-1 text-sm text-ink-200">{refLabel(preview.refs.milestone)}</p></div>
              <div className="rounded-lg bg-ink-950/35 p-3"><p className="text-xs font-semibold text-ink-500">상위 Todo</p><p className="mt-1 text-sm text-ink-200">{refLabel(preview.refs.parentTodo)}</p></div>
            </div>

            <div>
              <p className="text-sm font-bold text-ink-100">연결 데이터</p>
              <dl className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                <div className="rounded-lg bg-ink-950/35 p-3"><dt className="text-xs text-ink-500">하위 Todo</dt><dd className="mt-1 text-sm font-semibold text-ink-200">{countLabel(preview.links.children)}</dd></div>
                <div className="rounded-lg bg-ink-950/35 p-3"><dt className="text-xs text-ink-500">메모</dt><dd className="mt-1 text-sm font-semibold text-ink-200">{countLabel(preview.links.memos)}</dd></div>
                <div className="rounded-lg bg-ink-950/35 p-3"><dt className="text-xs text-ink-500">Time Block</dt><dd className="mt-1 text-sm font-semibold text-ink-200">{countLabel(preview.links.timeBlocks)}</dd></div>
                <div className="rounded-lg bg-ink-950/35 p-3"><dt className="text-xs text-ink-500">집중 기록</dt><dd className="mt-1 text-sm font-semibold text-ink-200">{countLabel(preview.links.focusSessions)}</dd></div>
                <div className="rounded-lg bg-ink-950/35 p-3"><dt className="text-xs text-ink-500">오늘 계획</dt><dd className="mt-1 text-sm font-semibold text-ink-200">{countLabel(preview.links.dailyPlans)}</dd></div>
              </dl>
            </div>

            {preview.warnings.length ? (
              <div className="rounded-lg border border-amber-400/30 bg-amber-500/10 p-3">
                <div className="flex items-center gap-2 text-sm font-bold text-amber-100"><AlertTriangle size={15} />복원 시 변경되는 항목</div>
                <ul className="mt-2 space-y-1 text-xs text-amber-100/90">{preview.warnings.map((warning) => <li key={warning}>• {warning}</li>)}</ul>
              </div>
            ) : <p className="rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100">기존 연결을 그대로 복원할 수 있습니다.</p>}

            <div className="flex justify-end gap-2 border-t border-ink-700 pt-4">
              <button type="button" className="btn-secondary" onClick={() => setPreview(null)} disabled={working}>취소</button>
              <button type="button" className="btn-primary" onClick={() => void restore()} disabled={!preview.restorable || working}><RotateCcw size={16} />{working ? "복원 중..." : "이 상태로 복원"}</button>
            </div>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
