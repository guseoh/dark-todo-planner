import { addDays } from "date-fns";
import { MoonStar } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useDailyReflection } from "../../hooks/useDailyReflection";
import { useTimeEntries } from "../../hooks/useTimeEntries";
import { useTimeTracking } from "../timer/TimeTrackingContext";
import { useTodoQuickActions } from "../todo/TodoQuickActionsContext";
import { TimeEntryModal } from "../timer/TimeEntryModal";
import type { TimeEntry, TimerTarget } from "../../types/timeTracking";
import { formatKoreanDate, parseDateKey, todayKey, toDateKey } from "../../lib/date";
import { activeAsEntry, formatDuration, intervalOnDay, plannerDayStart, measuredTotals, totalMs } from "../../lib/timeTracking";
import type { Todo } from "../../types/todo";
import { Modal } from "../common/Modal";

export type DayCloseDecision = "TOMORROW" | "SOMEDAY" | "KEEP";

type DayCloseModalProps = {
  todos: Todo[];
  recordTodos?: Todo[];
  /** Tasks already finished today, for the recap line. */
  completedCount: number;
  onClose: () => void;
  onApply: (decisions: Record<string, DayCloseDecision>) => Promise<{ ok: boolean; message?: string }>;
};

export function DayCloseModal({ todos, recordTodos = todos, completedCount, onClose, onApply }: DayCloseModalProps) {
  const today = todayKey();

  const timer = useTimeTracking();
  const actions = useTodoQuickActions();
  const categories = actions?.categories ?? [];
  const projects = actions?.projects ?? [];
  const { entries, loaded, error: timeError, create, update, remove } = useTimeEntries(today, today);
  const [now, setNow] = useState(Date.now);
  const [editingEntry, setEditingEntry] = useState<TimeEntry | "new" | null>(null);
  useEffect(() => {
    if (!timer?.active) return;
    setNow(Date.now());
    const handle = window.setInterval(() => setNow(Date.now()), 15_000);
    return () => window.clearInterval(handle);
  }, [timer?.active]);
  const allEntries = timer?.active ? [...entries, activeAsEntry(timer.active, now + timer.offsetMs)] : entries;
  const measuredMs = totalMs(measuredTotals(allEntries, [today], "category", categories, [], []));
  const visibleEntries = allEntries.filter(entry => intervalOnDay(entry.startedAt, entry.endedAt, today)).sort((a, b) => a.startedAt.localeCompare(b.startedAt));
  const resumeTarget = (entry: TimeEntry): TimerTarget | null => {
    if (entry.todoId) return recordTodos.some(todo => todo.id === entry.todoId && !todo.archived && !todo.completed) ? { todoId: entry.todoId } : null;
    if (entry.projectId) return projects.some(project => project.id === entry.projectId && !project.archived) ? { projectId: entry.projectId, categoryId: categories.some(category => category.id === entry.categoryId) ? entry.categoryId : undefined } : null;
    if (entry.categoryId && categories.some(category => category.id === entry.categoryId)) return { categoryId: entry.categoryId };
    return null;
  };
  const goalMs = (timer?.dailyGoalMinutes ?? 0) * 60_000;
  const manualEnd = Math.min(Date.now(), plannerDayStart(today).getTime() + 24 * 60 * 60_000);
  const manualStart = Math.max(plannerDayStart(today).getTime(), manualEnd - 30 * 60_000);
  const reflection = useDailyReflection(today);
  const [note, setNote] = useState("");
  const [noteTouched, setNoteTouched] = useState(false);
  useEffect(() => { if (reflection.loaded && !noteTouched) setNote(reflection.content); }, [reflection.content, reflection.loaded, noteTouched]);
  const noteDirty = reflection.loaded && !reflection.error && noteTouched && note.trim() !== reflection.content;
  const [decisions, setDecisions] = useState<Record<string, DayCloseDecision>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const tomorrow = useMemo(() => toDateKey(addDays(parseDateKey(todayKey()), 1)), []);

  useEffect(() => {
    setDecisions((current) => {
      const next: Record<string, DayCloseDecision> = {};
      for (const todo of todos) next[todo.id] = current[todo.id] || "KEEP";
      return next;
    });
  }, [todos]);

  const setAll = (decision: DayCloseDecision) => {
    setDecisions(Object.fromEntries(todos.map((todo) => [todo.id, decision])));
  };

  const apply = async () => {
    setSaving(true);
    setError("");
    try {
      if (noteDirty) await reflection.save(note.trim());
    } catch {
      setSaving(false);
      setError("회고를 저장하지 못했습니다. 연결을 확인하고 다시 시도하세요.");
      return;
    }
    const result = changesCount ? await onApply(decisions) : { ok: true };
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
  const changesCount = tomorrowCount + somedayCount;

  return (
    <>
    <Modal
      title="오늘 정리"
      description={`미완료 Todo ${todos.length}개를 검토합니다. 기본값은 오늘 유지이며, 명시적으로 선택한 항목만 이동합니다. 내일은 ${formatKoreanDate(tomorrow, "M월 d일 EEEE")}입니다.`}
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
            <button type="button" className="btn-secondary px-2.5 text-xs" disabled={!todos.length || saving} onClick={() => setAll("TOMORROW")}>모두 내일</button>
            <button type="button" className="btn-secondary px-2.5 text-xs" disabled={!todos.length || saving} onClick={() => setAll("SOMEDAY")}>모두 Someday</button>
            <button type="button" className="btn-secondary px-2.5 text-xs" disabled={!todos.length || saving} onClick={() => setAll("KEEP")}>모두 유지</button>
          </div>
        </div>

        <div className="rounded-lg border border-ink-700/70 bg-ink-950/45 p-3">
          <p className="text-xs text-ui-secondary" data-testid="day-recap">
            오늘 완료 <strong className="text-ui-text">{completedCount}개</strong>
            <> · 측정 <strong className="text-ui-text">{timeError ? "조회 실패" : loaded ? formatDuration(measuredMs) : "조회 중"}</strong></>
            {" · "}남은 할 일 <strong className="text-ui-text">{todos.length}개</strong>
          </p>
          {goalMs > 0 && loaded && !timeError ? <p className="mt-1 text-xs text-ui-muted">일일 목표 {formatDuration(goalMs)} · {Math.round(measuredMs / goalMs * 100)}%</p> : null}
          <div className="my-3 border-y border-ui-divider py-2">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold">오늘의 측정 기록</h3>
              <button type="button" className="btn-secondary text-xs" disabled={saving || !loaded || Boolean(timeError) || manualEnd <= manualStart} onClick={() => setEditingEntry("new")}>기록 추가</button>
            </div>
            {timeError ? <p role="alert" className="text-xs text-danger">{timeError}</p> : null}
            {loaded && !timeError && !visibleEntries.length ? <p className="py-2 text-xs text-ui-muted">아직 측정 기록이 없습니다.</p> : null}
            {loaded && !timeError ? <div className="max-h-48 overflow-y-auto">
              {visibleEntries.map(entry => {
                const part = intervalOnDay(entry.startedAt, entry.endedAt, today)!;
                const target = resumeTarget(entry);
                return <div key={entry.id} className="flex flex-wrap items-center gap-2 border-b border-ui-divider py-2 text-xs">
                  <span className="min-w-0 flex-1 truncate" title={entry.title}>{entry.title}</span>
                  <span className="tabular-nums text-ui-muted">{formatDuration((part.end - part.start) * 60_000)}</span>
                  {entry.id === "active" ? <span className="text-success">측정 중</span> : <>
                    {target && timer && !timer.active ? <button type="button" className="btn-secondary text-xs" disabled={saving || timer.busy} onClick={() => void timer.start(target)}>재개</button> : null}
                    <button type="button" className="btn-secondary text-xs" disabled={saving} onClick={() => setEditingEntry(entry)}>수정</button>
                  </>}
                </div>;
              })}
            </div> : null}
          </div>
          <label className="mt-2 grid gap-1 text-xs font-semibold text-ui-secondary">오늘의 한 줄 회고 (선택)
            <textarea className="field min-h-16 resize-y text-sm font-normal" value={note} maxLength={1000} disabled={saving || !reflection.loaded || Boolean(reflection.error)}
              onChange={(event) => { setNote(event.target.value); setNoteTouched(true); }}
              placeholder="무엇을 했고, 내일 이어갈 것은 무엇인가요?" />
          </label>
          {!reflection.loaded && !reflection.error ? (
            <p role="status" className="mt-1 text-xs text-ui-muted">기존 회고를 불러오는 중…</p>
          ) : null}
          {reflection.error ? (
            <div role="alert" className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-danger">
              <span>{reflection.error} 저장된 내용을 확인하기 전에는 회고를 수정할 수 없습니다.</span>
              <button type="button" className="btn-secondary px-2.5 text-xs" disabled={saving} onClick={reflection.retry}>다시 조회</button>
            </div>
          ) : null}
        </div>

        {todos.length ? null : <p className="text-xs text-ui-muted">남은 할 일이 없습니다. 회고만 저장할 수 있습니다.</p>}
        <div className="max-h-[min(56vh,34rem)] space-y-2 overflow-y-auto pr-1">
          {todos.map((todo) => (
            <div key={todo.id} className="flex flex-col gap-2 rounded-lg border border-ink-800 bg-ink-950/25 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-ink-100">{todo.title}</p>
                <p className="mt-0.5 text-[11px] text-ink-500">{todo.category?.name || "미분류"}</p>
              </div>
              <select
                className="field min-h-9 shrink-0 py-1.5 text-xs sm:w-40"
                value={decisions[todo.id] || "KEEP"}
                onChange={(event) => setDecisions((current) => ({ ...current, [todo.id]: event.target.value as DayCloseDecision }))}
                disabled={saving}
                aria-label={`“${todo.title}” 오늘 정리 처리`}
              >
                <option value="TOMORROW">내일로 이동</option>
                <option value="SOMEDAY">Someday</option>
                <option value="KEEP">오늘 유지</option>
              </select>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-2 border-t border-ink-700/70 pt-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-ink-500">내일 {tomorrowCount} · Someday {somedayCount} · 유지 {keepCount}</p>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-secondary" disabled={saving} onClick={onClose}>취소</button>
            <button type="button" className="btn-primary" disabled={saving || (!changesCount && !noteDirty)} onClick={() => void apply()}>{saving ? "저장 중..." : changesCount ? `선택한 ${changesCount}개 반영${noteDirty ? " + 회고 저장" : ""}` : noteDirty ? "회고 저장" : "선택한 0개 반영"}</button>
          </div>
        </div>

        {error ? <p className="rounded-md border border-danger/40 bg-danger/[0.08] px-3 py-2 text-xs font-semibold text-danger" role="alert">{error}</p> : null}
      </div>
    </Modal>
    {editingEntry ? <TimeEntryModal entry={editingEntry === "new" ? undefined : editingEntry} categories={categories} todos={recordTodos}
      defaultStart={new Date(manualStart).toISOString()} defaultEnd={new Date(manualEnd).toISOString()}
      onClose={() => setEditingEntry(null)} onCreate={create} onUpdate={update} onDelete={remove} /> : null}
    </>
  );
}
