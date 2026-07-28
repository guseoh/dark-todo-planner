import { useMemo, useState } from "react";
import { CopyPlus, MoveRight } from "lucide-react";
import { formatKoreanDate } from "../../lib/date";
import {
  buildDefaultOverdueSelection,
  getDuplicateTodoIds,
  type OverdueTodoImportMode,
  type OverdueTodoImportResult,
} from "../../lib/todoRecovery";
import type { Todo } from "../../types/todo";
import { Modal } from "../common/Modal";

type OverdueTodoImportModalProps = {
  todos: Todo[];
  onImport: (
    selectedIds: ReadonlySet<string>,
    mode: OverdueTodoImportMode,
  ) => Promise<OverdueTodoImportResult>;
  onClose: () => void;
};

export function OverdueTodoImportModal({ todos, onImport, onClose }: OverdueTodoImportModalProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => buildDefaultOverdueSelection(todos));
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<OverdueTodoImportResult | null>(null);
  const duplicateTodoIds = useMemo(() => getDuplicateTodoIds(todos), [todos]);
  const groupedTodos = useMemo(() => {
    const groups = new Map<string, Todo[]>();
    todos.forEach((todo) => groups.set(todo.date, [...(groups.get(todo.date) || []), todo]));
    return [...groups.entries()].sort(([left], [right]) => left.localeCompare(right));
  }, [todos]);

  const toggleTodo = (id: string) => {
    if (submitting) return;
    setResult(null);
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const runImport = async (mode: OverdueTodoImportMode) => {
    if (!selectedIds.size || submitting) return;
    setSubmitting(true);
    setResult(null);
    try {
      setResult(await onImport(selectedIds, mode));
      setSelectedIds(new Set());
    } catch {
      setResult({
        total: selectedIds.size,
        success: 0,
        skipped: 0,
        failed: selectedIds.size,
        mode,
      });
    } finally {
      setSubmitting(false);
    }
  };

  const resultMessage = result
    ? `${result.mode === "move" ? "이동" : "복사"} 성공 ${result.success}개 · 건너뜀 ${result.skipped}개 · 실패 ${result.failed}개`
    : "";

  return (
    <Modal
      title="미처리 Todo 가져오기"
      description="가져올 항목을 선택하세요. 이동은 기존 일정을 오늘로 옮기고, 복사는 원래 일정을 유지합니다."
      onClose={() => {
        if (!submitting) onClose();
      }}
      size="lg"
    >
      <div className="space-y-4">
        <p className="text-xs text-ink-500">
          같은 제목·카테고리의 중복 후보는 가장 최근 항목만 기본 선택됩니다. 다른 항목도 직접 선택할 수 있습니다.
        </p>

        <div className="max-h-[55vh] space-y-4 overflow-y-auto pr-1">
          {groupedTodos.map(([date, dateTodos]) => (
            <section key={date} aria-labelledby={`overdue-${date}`}>
              <h4 id={`overdue-${date}`} className="sticky top-0 z-10 bg-ink-900/95 py-2 text-sm font-bold text-ink-200">
                {formatKoreanDate(date, "M월 d일 EEEE")}
              </h4>
              <div className="space-y-2">
                {dateTodos.map((todo) => (
                  <label
                    key={todo.id}
                    className="flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border border-ink-700 bg-ink-950/45 p-3 transition hover:border-accent-500/60"
                  >
                    <input
                      type="checkbox"
                      className="mt-1 h-4 w-4 accent-indigo-500"
                      checked={selectedIds.has(todo.id)}
                      onChange={() => toggleTodo(todo.id)}
                      disabled={submitting}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="break-words text-sm font-semibold text-ink-100">{todo.title}</span>
                        {duplicateTodoIds.has(todo.id) ? (
                          <span className="rounded-full border border-amber-400/40 bg-amber-400/10 px-2 py-0.5 text-[11px] font-semibold text-amber-100">
                            중복 후보
                          </span>
                        ) : null}
                      </span>
                      <span className="mt-1 block text-xs text-ink-500">
                        {todo.category?.name || "미분류"} · 원래 일정 {formatKoreanDate(todo.date, "M월 d일")}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </section>
          ))}
        </div>

        {resultMessage ? (
          <p
            role="status"
            className={`rounded-lg border px-3 py-2 text-sm ${
              result?.failed
                ? "border-danger/40 bg-danger/10 text-red-100"
                : "border-emerald-400/30 bg-emerald-400/10 text-emerald-100"
            }`}
          >
            {resultMessage}
          </p>
        ) : null}

        <div className="flex flex-col-reverse gap-2 border-t border-ink-700 pt-4 sm:flex-row sm:justify-end">
          <button type="button" className="btn-secondary justify-center" onClick={onClose} disabled={submitting}>
            닫기
          </button>
          <button
            type="button"
            className="btn-secondary justify-center"
            onClick={() => runImport("copy")}
            disabled={!selectedIds.size || submitting}
          >
            <CopyPlus size={16} />
            선택 항목 복사
          </button>
          <button
            type="button"
            className="btn-primary justify-center"
            onClick={() => runImport("move")}
            disabled={!selectedIds.size || submitting}
          >
            <MoveRight size={16} />
            {submitting ? "처리 중..." : "선택 항목 이동"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
