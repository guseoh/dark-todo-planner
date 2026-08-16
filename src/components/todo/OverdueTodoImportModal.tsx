import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, CopyPlus, MoveRight } from "lucide-react";
import { formatKoreanDate } from "../../lib/date";
import {
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
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<OverdueTodoImportResult | null>(null);
  const duplicateTodoIds = useMemo(() => getDuplicateTodoIds(todos), [todos]);
  const groupedTodos = useMemo(() => {
    const groups = new Map<string, Todo[]>();
    todos.forEach((todo) => groups.set(todo.date, [...(groups.get(todo.date) || []), todo]));
    return [...groups.entries()]
      .sort(([left], [right]) => right.localeCompare(left))
      .map(([date, dateTodos]) => [
        date,
        [...dateTodos].sort((left, right) => {
          if (left.completed !== right.completed) return left.completed ? 1 : -1;
          return right.createdAt.localeCompare(left.createdAt);
        }),
      ] as const);
  }, [todos]);
  const [expandedDates, setExpandedDates] = useState<Set<string>>(
    () => new Set(groupedTodos.slice(0, 2).map(([date]) => date)),
  );

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

  const toggleDate = (date: string) => {
    if (submitting) return;
    setExpandedDates((current) => {
      const next = new Set(current);
      if (next.has(date)) next.delete(date);
      else next.add(date);
      return next;
    });
  };

  const selectAll = () => {
    if (submitting) return;
    setResult(null);
    setSelectedIds(new Set(todos.map((todo) => todo.id)));
  };

  const selectExpanded = () => {
    if (submitting) return;
    setResult(null);
    setSelectedIds(
      new Set(
        groupedTodos
          .filter(([date]) => expandedDates.has(date))
          .flatMap(([, dateTodos]) => dateTodos.map((todo) => todo.id)),
      ),
    );
  };

  const clearSelection = () => {
    if (submitting) return;
    setResult(null);
    setSelectedIds(new Set());
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
      description="필요한 Todo만 직접 선택하세요. 이동은 기존 일정을 오늘로 옮기고, 복사는 원래 일정을 유지합니다."
      onClose={() => {
        if (!submitting) onClose();
      }}
      size="lg"
    >
      <div className="space-y-3">
        <div className="rounded-md border border-ink-700/55 bg-ink-950/35 p-3">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-bold text-ink-100">{selectedIds.size}개 선택됨</p>
              <p className="mt-0.5 text-[11px] leading-5 text-ink-500">
                중복 후보는 표시만 하며 자동 선택하지 않습니다. 여러 중복 항목을 선택하면 최신 항목부터 처리합니다.
              </p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <button type="button" className="btn-secondary px-2.5 text-xs" onClick={selectAll} disabled={!todos.length || submitting}>
                전체 선택
              </button>
              <button type="button" className="btn-secondary px-2.5 text-xs" onClick={selectExpanded} disabled={!expandedDates.size || submitting}>
                펼친 날짜 선택
              </button>
              <button type="button" className="btn-secondary px-2.5 text-xs" onClick={clearSelection} disabled={!selectedIds.size || submitting}>
                전체 해제
              </button>
            </div>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5 border-t border-ink-700/45 pt-2">
            <button
              type="button"
              className="rounded-md px-2 py-1 text-xs font-semibold text-ink-400 transition hover:bg-ink-800 hover:text-ink-100"
              onClick={() => setExpandedDates(new Set(groupedTodos.map(([date]) => date)))}
              disabled={!groupedTodos.length || submitting}
            >
              모두 펼치기
            </button>
            <button
              type="button"
              className="rounded-md px-2 py-1 text-xs font-semibold text-ink-400 transition hover:bg-ink-800 hover:text-ink-100"
              onClick={() => setExpandedDates(new Set())}
              disabled={!expandedDates.size || submitting}
            >
              모두 접기
            </button>
            <span className="self-center text-[11px] text-ink-600">최근 날짜 2개만 기본으로 펼쳐집니다.</span>
          </div>
        </div>

        <div className="max-h-[52vh] space-y-2 overflow-y-auto pr-1">
          {groupedTodos.map(([date, dateTodos]) => {
            const expanded = expandedDates.has(date);
            const selectedCount = dateTodos.filter((todo) => selectedIds.has(todo.id)).length;
            return (
              <section key={date} className="overflow-hidden rounded-md border border-ink-700/55 bg-ink-900/45" aria-labelledby={`overdue-${date}`}>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 px-3 py-2.5 text-left transition hover:bg-ink-800/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent-500/35"
                  onClick={() => toggleDate(date)}
                  aria-expanded={expanded}
                  aria-controls={`overdue-list-${date}`}
                >
                  {expanded ? <ChevronDown size={16} className="shrink-0 text-ink-400" /> : <ChevronRight size={16} className="shrink-0 text-ink-500" />}
                  <span id={`overdue-${date}`} className="min-w-0 flex-1 text-sm font-bold text-ink-200">
                    {formatKoreanDate(date, "M월 d일 EEEE")}
                  </span>
                  <span className="shrink-0 text-xs text-ink-500">{dateTodos.length}개</span>
                  {selectedCount ? (
                    <span className="shrink-0 rounded-full border border-accent-500/35 bg-accent-500/10 px-2 py-0.5 text-[10px] font-bold text-accent-200">
                      {selectedCount}개 선택
                    </span>
                  ) : null}
                </button>

                {expanded ? (
                  <div id={`overdue-list-${date}`} className="space-y-1.5 border-t border-ink-700/45 p-2">
                    {dateTodos.map((todo) => {
                      const checked = selectedIds.has(todo.id);
                      return (
                        <label
                          key={todo.id}
                          className={`flex cursor-pointer items-start gap-3 rounded-md border px-3 py-2.5 transition ${
                            checked
                              ? "border-accent-500/55 bg-accent-500/10"
                              : "border-ink-700/55 bg-ink-950/35 hover:border-ink-600 hover:bg-ink-900/80"
                          }`}
                        >
                          <input
                            type="checkbox"
                            className="mt-0.5 h-4 w-4 shrink-0 accent-accent-500"
                            checked={checked}
                            onChange={() => toggleTodo(todo.id)}
                            disabled={submitting}
                          />
                          <span className="min-w-0 flex-1">
                            <span className="flex flex-wrap items-center gap-1.5">
                              <span className={`break-words text-sm font-semibold ${todo.completed ? "text-ink-500 line-through" : "text-ink-100"}`}>{todo.title}</span>
                              {duplicateTodoIds.has(todo.id) ? (
                                <span className="rounded-full border border-amber-400/40 bg-amber-400/10 px-2 py-0.5 text-[10px] font-semibold text-amber-100">
                                  중복 후보
                                </span>
                              ) : null}
                              {todo.completed ? <span className="text-[10px] font-semibold text-ink-600">완료</span> : null}
                            </span>
                            <span className="mt-0.5 block text-[11px] text-ink-500">
                              {todo.category?.name || "미분류"} · 원래 일정 {formatKoreanDate(todo.date, "M월 d일")}
                            </span>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                ) : null}
              </section>
            );
          })}
        </div>

        {resultMessage ? (
          <p
            role="status"
            className={`rounded-md border px-3 py-2 text-sm ${
              result?.failed
                ? "border-danger/40 bg-danger/10 text-red-100"
                : "border-emerald-400/30 bg-emerald-400/10 text-emerald-100"
            }`}
          >
            {resultMessage}
          </p>
        ) : null}

        <div className="flex flex-col-reverse gap-2 border-t border-ink-700/55 pt-3 sm:flex-row sm:justify-end">
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
            선택 {selectedIds.size}개 복사
          </button>
          <button
            type="button"
            className="btn-primary justify-center"
            onClick={() => runImport("move")}
            disabled={!selectedIds.size || submitting}
          >
            <MoveRight size={16} />
            {submitting ? "처리 중..." : `선택 ${selectedIds.size}개 이동`}
          </button>
        </div>
      </div>
    </Modal>
  );
}
