import { addDays } from "date-fns";
import { CalendarClock, MoonStar } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { formatKoreanDate, parseDateKey, todayKey, toDateKey } from "../../lib/date";
import type { Todo } from "../../types/todo";
import { Modal } from "../common/Modal";

export type DayCloseDecision = "TOMORROW" | "SOMEDAY" | "KEEP";

type DayCloseModalProps = {
  todos: Todo[];
  onClose: () => void;
  onApply: (decisions: Record<string, DayCloseDecision>) => Promise<{ ok: boolean; message?: string }>;
};

export function DayCloseModal({ todos, onClose, onApply }: DayCloseModalProps) {
  const [decisions, setDecisions] = useState<Record<string, DayCloseDecision>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const tomorrow = useMemo(() => toDateKey(addDays(parseDateKey(todayKey()), 1)), []);
  const actionableTodos = useMemo(() => todos.filter((todo) => todo.repeat === "NONE"), [todos]);
  const repeatingTodos = useMemo(() => todos.filter((todo) => todo.repeat !== "NONE"), [todos]);

  useEffect(() => {
    setDecisions((current) => {
      const next: Record<string, DayCloseDecision> = {};
      for (const todo of actionableTodos) next[todo.id] = current[todo.id] || "TOMORROW";
      return next;
    });
  }, [actionableTodos]);

  const setAll = (decision: DayCloseDecision) => {
    setDecisions(Object.fromEntries(actionableTodos.map((todo) => [todo.id, decision])));
  };

  const apply = async () => {
    setSaving(true);
    setError("");
    const result = await onApply(decisions);
    setSaving(false);
    if (result.ok) {
      onClose();
      return;
    }
    setError(result.message || "하루 마감 처리를 완료하지 못했습니다.");
  };

  const tomorrowCount = Object.values(decisions).filter((decision) => decision === "TOMORROW").length;
  const somedayCount = Object.values(decisions).filter((decision) => decision === "SOMEDAY").length;
  const keepCount = Object.values(decisions).filter((decision) => decision === "KEEP").length;

  return (
    <Modal
      title="하루 마감"
      description={`오늘 남은 Todo를 검토합니다. 내일은 ${formatKoreanDate(tomorrow, "M월 d일 EEEE")}입니다.`}
      onClose={saving ? () => undefined : onClose}
      size="lg"
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-ink-700/70 bg-ink-950/45 p-3">
          <div className="flex items-center gap-2">
            <MoonStar size={17} className="text-accent-300" />
            <div>
              <p className="text-sm font-bold text-ink-100">미완료 {todos.length}개</p>
              <p className="text-[11px] text-ink-500">변경할 항목만 확정 후 서버에 반영합니다.</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <button type="button" className="btn-secondary px-2.5 text-xs" disabled={!actionableTodos.length || saving} onClick={() => setAll("TOMORROW")}>모두 내일</button>
            <button type="button" className="btn-secondary px-2.5 text-xs" disabled={!actionableTodos.length || saving} onClick={() => setAll("SOMEDAY")}>모두 Someday</button>
            <button type="button" className="btn-secondary px-2.5 text-xs" disabled={!actionableTodos.length || saving} onClick={() => setAll("KEEP")}>모두 유지</button>
          </div>
        </div>

        <div className="max-h-[min(56vh,34rem)] space-y-2 overflow-y-auto pr-1">
          {actionableTodos.map((todo) => (
            <div key={todo.id} className="flex flex-col gap-2 rounded-lg border border-ink-800 bg-ink-950/25 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-ink-100">{todo.title}</p>
                <p className="mt-0.5 text-[11px] text-ink-500">{todo.category?.name || "미분류"}{todo.dueDate ? ` · 마감 ${todo.dueDate}` : ""}</p>
              </div>
              <select
                className="field min-h-9 shrink-0 py-1.5 text-xs sm:w-40"
                value={decisions[todo.id] || "TOMORROW"}
                onChange={(event) => setDecisions((current) => ({ ...current, [todo.id]: event.target.value as DayCloseDecision }))}
                disabled={saving}
                aria-label={`“${todo.title}” 하루 마감 처리`}
              >
                <option value="TOMORROW">내일로 이동</option>
                <option value="SOMEDAY">Someday</option>
                <option value="KEEP">오늘 유지</option>
              </select>
            </div>
          ))}

          {repeatingTodos.length ? (
            <div className="rounded-lg border border-warning/20 bg-warning/[0.035] px-3 py-2.5">
              <div className="flex items-start gap-2">
                <CalendarClock size={15} className="mt-0.5 shrink-0 text-amber-200" />
                <div>
                  <p className="text-xs font-semibold text-amber-100">반복 Todo {repeatingTodos.length}개는 그대로 유지합니다.</p>
                  <p className="mt-1 text-[11px] text-ink-500">현재 데이터 모델은 반복 발생 건을 별도 인스턴스로 저장하지 않아 원본 날짜를 이동하지 않습니다.</p>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        <div className="flex flex-col gap-2 border-t border-ink-700/70 pt-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-ink-500">내일 {tomorrowCount} · Someday {somedayCount} · 유지 {keepCount}</p>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-secondary" disabled={saving} onClick={onClose}>취소</button>
            <button type="button" className="btn-primary" disabled={saving || !actionableTodos.length} onClick={() => void apply()}>{saving ? "반영 중..." : "하루 마감 적용"}</button>
          </div>
        </div>

        {error ? <p className="rounded-md border border-danger/40 bg-danger/[0.08] px-3 py-2 text-xs font-semibold text-red-100" role="alert">{error}</p> : null}
      </div>
    </Modal>
  );
}
