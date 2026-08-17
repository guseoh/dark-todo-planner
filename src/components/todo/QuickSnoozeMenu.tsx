import { addDays } from "date-fns";
import { CalendarClock, ChevronDown } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { getWeekRange, parseDateKey, todayKey, toDateKey } from "../../lib/date";
import type { Todo } from "../../types/todo";
import { useTodoQuickActions, type TodoSnoozeTarget } from "./TodoQuickActionsContext";

export function QuickSnoozeMenu({ todo }: { todo: Todo }) {
  const quickActions = useTodoQuickActions();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [customDate, setCustomDate] = useState("");

  const dates = useMemo(() => {
    const today = todayKey();
    const tomorrow = toDateKey(addDays(parseDateKey(today), 1));
    const inThreeDays = toDateKey(addDays(parseDateKey(today), 3));
    const nextMonday = toDateKey(addDays(parseDateKey(getWeekRange().end), 1));
    return { tomorrow, inThreeDays, nextMonday };
  }, []);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  if (!quickActions || todo.completed || todo.archived || todo.repeat !== "NONE") return null;

  const apply = async (target: TodoSnoozeTarget) => {
    setSaving(true);
    const success = await quickActions.snoozeTodo(todo, target);
    setSaving(false);
    if (success) {
      setOpen(false);
      setCustomDate("");
    }
  };

  const itemClass = "w-full rounded-md px-3 py-2 text-left text-xs font-semibold text-ink-300 transition hover:bg-ink-800 hover:text-ink-100 disabled:cursor-not-allowed disabled:opacity-50";

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        className="icon-btn h-8 w-8"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`“${todo.title}” 빠른 미루기`}
        title="빠른 미루기"
      >
        <CalendarClock size={13} />
      </button>
      {open ? (
        <div role="menu" className="absolute right-0 top-full z-50 mt-1 w-52 rounded-lg border border-ink-700 bg-ink-900 p-1.5 shadow-2xl">
          <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-ink-600">빠른 미루기</p>
          <button type="button" role="menuitem" className={itemClass} disabled={saving} onClick={() => void apply({ type: "DATE", date: dates.tomorrow })}>내일 <span className="float-right font-normal text-ink-600">{dates.tomorrow.slice(5)}</span></button>
          <button type="button" role="menuitem" className={itemClass} disabled={saving} onClick={() => void apply({ type: "DATE", date: dates.inThreeDays })}>3일 뒤 <span className="float-right font-normal text-ink-600">{dates.inThreeDays.slice(5)}</span></button>
          <button type="button" role="menuitem" className={itemClass} disabled={saving} onClick={() => void apply({ type: "DATE", date: dates.nextMonday })}>다음 주 월요일 <span className="float-right font-normal text-ink-600">{dates.nextMonday.slice(5)}</span></button>
          <button type="button" role="menuitem" className={itemClass} disabled={saving} onClick={() => void apply({ type: "SOMEDAY" })}>Someday로 보내기</button>
          <div className="my-1 border-t border-ink-700/70" />
          <label className="block px-2 py-1 text-[10px] font-semibold text-ink-500">날짜 선택</label>
          <div className="flex gap-1.5 px-1 pb-1">
            <input className="field min-h-8 py-1 text-xs" type="date" min={dates.tomorrow} value={customDate} onChange={(event) => setCustomDate(event.target.value)} />
            <button type="button" className="btn-secondary min-h-8 shrink-0 px-2 py-1 text-xs" disabled={!customDate || saving} onClick={() => void apply({ type: "DATE", date: customDate })}>
              <ChevronDown size={12} className="-rotate-90" />적용
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
