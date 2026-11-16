import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import { addDays } from "date-fns";
import { api, jsonBody } from "../../lib/api/client";
import { PLANNER_DAY_START_HOUR, formatKoreanDate, parseDateKey, toDateKey, todayKey } from "../../lib/date";
import { getEntityColor } from "../../lib/entityColor";
import {
  DAY_MINUTES, activeAsEntry, clockLabel, entryCategoryName, entryColor, formatDuration, intervalOnDay,
  plannerDayStart, totalMs, totalsByCategory,
} from "../../lib/timeTracking";
import { useTimeEntries } from "../../hooks/useTimeEntries";
import type { Project } from "../../types/project";
import type { TimeBlock, TimeBlockInput } from "../../types/time";
import type { TimeEntry } from "../../types/timeTracking";
import type { Todo } from "../../types/todo";
import { TimeEntryModal } from "../timer/TimeEntryModal";
import { useTimeTracking } from "../timer/TimeTrackingContext";
import { useTodoQuickActions } from "../todo/TodoQuickActionsContext";

/**
 * The vertical axis is the planner day (03:00 → 03:00), in minutes from 03:00, so late-night
 * work stays on the day it belongs to. Planned blocks keep their clock times in D1; blocks that
 * start before 03:00 are drawn at the bottom of the previous day's column.
 */
const DAY_START = PLANNER_DAY_START_HOUR * 60;
const STEP = 15;
const HOUR_PX = 48;
const DEFAULT_WINDOW: [number, number] = [6, 16]; // 09:00–19:00
const FULL_KEY = "dark-todo-planner:timetable-full-day";
const clock = (value: string) => Number(value.slice(0, 2)) * 60 + Number(value.slice(3, 5));
const clockText = (value: number) => `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const shiftDate = (date: string, days: number) => toDateKey(addDays(parseDateKey(date), days));

type Placed = { block: TimeBlock; column: string; start: number; end: number };
const place = (block: TimeBlock): Placed => {
  const start = clock(block.startTime); const end = clock(block.endTime);
  return start < DAY_START
    ? { block, column: shiftDate(block.date, -1), start: start + DAY_MINUTES - DAY_START, end: Math.min(DAY_MINUTES, end + DAY_MINUTES - DAY_START) }
    : { block, column: block.date, start: start - DAY_START, end: Math.min(DAY_MINUTES, end - DAY_START) };
};
/** Planner-day column + offsets → the date and clock times stored in D1 (a block cannot cross midnight). */
const toBlockFields = (column: string, startOffset: number, endOffset: number) => {
  let start = startOffset + DAY_START; let end = endOffset + DAY_START; let date = column;
  if (start >= DAY_MINUTES) { date = shiftDate(column, 1); start -= DAY_MINUTES; end -= DAY_MINUTES; }
  else end = Math.min(end, DAY_MINUTES - 1);
  return { date, startTime: clockText(start), endTime: clockText(Math.max(end, start + 1)) };
};

type Props = {
  dates: string[];
  selectedDate: string;
  todos: Todo[];
  projects: Project[];
  onSelect: (date: string) => void;
  onOpenTodo: (todo: Todo) => void;
  onSchedule: (todo: Todo, date: string) => Promise<boolean>;
  onReloadTodos: () => Promise<void>;
};

export function WeeklyTimetable({ dates, selectedDate, todos, projects, onSelect, onOpenTodo, onSchedule, onReloadTodos }: Props) {
  const categories = useTodoQuickActions()?.categories ?? [];
  const timer = useTimeTracking();
  const weekStart = dates[0];
  const weekEnd = dates[6];
  const { entries, create, update, remove } = useTimeEntries(weekStart, weekEnd);
  const [visible, setVisible] = useState(() => window.matchMedia("(min-width: 1280px)").matches);
  const [blocks, setBlocks] = useState<TimeBlock[]>([]);
  const [loadedWeek, setLoadedWeek] = useState("");
  const [now, setNow] = useState(() => new Date());
  const [error, setError] = useState("");
  const [fullDay, setFullDay] = useState(() => { try { return localStorage.getItem(FULL_KEY) === "1"; } catch { return false; } });
  const [editingEntry, setEditingEntry] = useState<TimeEntry | null>(null);
  const writeInProgress = useRef(false);
  const gesture = useRef<{ column: string; start: number; block?: Placed } | null>(null);
  const [selection, setSelection] = useState<{ column: string; start: number; end: number } | null>(null);
  const today = todayKey(now);
  const weekBlocks = useMemo(() => loadedWeek === weekStart ? blocks.map(place).filter(({ column }) => dates.includes(column)) : [], [blocks, dates, loadedWeek, weekStart]);

  const active = timer?.active ?? null;
  const allEntries = useMemo(
    () => active ? [...entries, activeAsEntry(active, now.getTime() + (timer?.offsetMs ?? 0))] : entries,
    [active, entries, now, timer?.offsetMs],
  );

  // Show 09:00–19:00 by default, widening to whatever planned or measured work exists.
  const [startHour, endHour] = useMemo(() => {
    if (fullDay) return [0, 24] as [number, number];
    let lo = DEFAULT_WINDOW[0] * 60; let hi = DEFAULT_WINDOW[1] * 60;
    for (const { start, end } of weekBlocks) { lo = Math.min(lo, start); hi = Math.max(hi, end); }
    for (const entry of allEntries) {
      for (const date of dates) {
        const part = intervalOnDay(entry.startedAt, entry.endedAt, date);
        if (part) { lo = Math.min(lo, part.start); hi = Math.max(hi, part.end); }
      }
    }
    return [Math.max(0, Math.floor(lo / 60)), Math.min(24, Math.ceil(hi / 60))] as [number, number];
  }, [allEntries, dates, fullDay, weekBlocks]);
  const winStart = startHour * 60; const winEnd = endHour * 60;
  const percent = (minutes: number) => minutes / (winEnd - winStart) * 100;
  const hours = Array.from({ length: endHour - startHour }, (_, index) => startHour + index);

  const dayTotals = useMemo(() => new Map(dates.map((date) => [date, totalMs(totalsByCategory(allEntries, [date], categories))])), [allEntries, categories, dates]);
  const weekTotals = useMemo(() => totalsByCategory(allEntries, dates, categories), [allEntries, categories, dates]);
  const hasActual = allEntries.length > 0;

  useEffect(() => {
    const media = window.matchMedia("(min-width: 1280px)");
    const sync = () => setVisible(media.matches);
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (!visible) return;
    let live = true;
    setError("");
    // Blocks starting before 03:00 on the day after the week belong to the last column.
    void api<{ timeBlocks: TimeBlock[] }>(`/api/time-blocks?from=${weekStart}&to=${shiftDate(weekEnd, 1)}`)
      .then(({ timeBlocks }) => { if (live) { setBlocks(timeBlocks); setLoadedWeek(weekStart); } })
      .catch(() => { if (live) setError("시간 블록을 불러오지 못했습니다."); });
    // The grid shows minutes: a running timer refreshes it every 15s instead of redrawing the whole week each second.
    const timerId = window.setInterval(() => setNow(new Date()), active ? 15_000 : 60_000);
    return () => { live = false; window.clearInterval(timerId); };
  }, [visible, weekStart, weekEnd, active]);

  const toggleFullDay = () => {
    setFullDay((value) => {
      try { localStorage.setItem(FULL_KEY, value ? "0" : "1"); } catch { /* preference only */ }
      return !value;
    });
  };

  const save = async (input: TimeBlockInput, block?: TimeBlock, todo?: Todo) => {
    if (writeInProgress.current || loadedWeek !== weekStart) return;
    writeInProgress.current = true;
    setError("");
    try {
      const scheduleTodo = Boolean(todo && (todo.date !== input.date || todo.planningState !== "SCHEDULED"));
      const path = block ? `/api/time-blocks/${block.id}` : "/api/time-blocks";
      const { timeBlock } = await api<{ timeBlock: TimeBlock }>(path, {
        method: block ? "PUT" : "POST", ...jsonBody({ ...input, scheduleTodo }),
      });
      setBlocks((items) => [...items.filter(({ id }) => id !== timeBlock.id), timeBlock]);
      if (scheduleTodo) await onReloadTodos().catch(() => setError("시간 블록은 저장했습니다. 최신 할 일을 불러오지 못했습니다."));
    } catch (err) {
      setError(err instanceof Error ? err.message : "시간 블록을 저장하지 못했습니다.");
    } finally {
      writeInProgress.current = false;
    }
  };

  const minuteAt = (element: HTMLElement, clientY: number) => {
    const rect = element.getBoundingClientRect();
    const raw = winStart + (clientY - rect.top) / rect.height * (winEnd - winStart);
    return clamp(Math.round(raw / STEP) * STEP, winStart, winEnd);
  };
  const begin = (event: PointerEvent<HTMLDivElement>, column: string) => {
    if (event.button !== 0 || loadedWeek !== weekStart) return;
    const target = event.target as HTMLElement;
    const resizeId = target.closest<HTMLElement>("[data-resize-block]")?.dataset.resizeBlock;
    const block = weekBlocks.find(({ block: item }) => item.id === resizeId);
    if (!block && target.closest("[data-time-block], [data-time-actual]")) return;
    const start = block ? block.start : clamp(minuteAt(event.currentTarget, event.clientY), winStart, winEnd - STEP);
    event.currentTarget.setPointerCapture(event.pointerId);
    gesture.current = { column, start, block };
    setSelection({ column, start: Math.max(winStart, start), end: block ? block.end : start + STEP });
  };
  const move = (event: PointerEvent<HTMLDivElement>) => {
    const current = gesture.current;
    if (!current) return;
    const point = minuteAt(event.currentTarget, event.clientY);
    const start = current.block ? current.start : Math.min(current.start, point);
    const end = Math.max(current.start + STEP, point);
    setSelection({ column: current.column, start: Math.max(winStart, start), end });
  };
  const finish = (event: PointerEvent<HTMLDivElement>) => {
    const current = gesture.current;
    gesture.current = null;
    setSelection(null);
    if (!current) return;
    const point = minuteAt(event.currentTarget, event.clientY);
    const start = current.block ? current.start : Math.min(current.start, point);
    const end = Math.max(current.start + STEP, point);
    const block = current.block?.block;
    void save({ title: block?.title ?? "시간 블록", todoId: block?.todoId ?? undefined, completed: block?.completed,
      ...toBlockFields(current.column, start, end) }, block);
  };

  if (!visible) return null;
  const nowOffset = (now.getTime() - plannerDayStart(today).getTime()) / 60_000;
  return (
    <section className="calendar-week-timetable min-w-0" aria-label="주간 시간표" style={{ ["--time-rows" as string]: endHour - startHour }}>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <p className="min-w-0 text-xs text-ui-muted">
          {hasActual ? "각 날짜의 왼쪽은 계획, 오른쪽 막대는 실제로 측정한 시간입니다." : "빈 곳을 드래그해 계획 블록을 만들고, 할 일의 ▶ 버튼으로 실제 시간을 측정합니다."}
        </p>
        <button type="button" className="btn-secondary text-xs" aria-pressed={fullDay} onClick={toggleFullDay}>
          {fullDay ? "업무 시간만 보기" : "하루 전체 보기"}
        </button>
      </div>
      {weekTotals.length ? (
        <ul className="calendar-week-totals" aria-label="이번 주 카테고리별 측정 시간">
          <li className="font-semibold text-ui-text">측정 {formatDuration(totalMs(weekTotals))}</li>
          {weekTotals.map((item) => (
            <li key={item.key}><span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} aria-hidden="true" />{item.name} {formatDuration(item.ms)}</li>
          ))}
        </ul>
      ) : null}
      {error ? <p role="alert" className="mb-2 text-xs text-danger">{error}</p> : null}
      <div className="calendar-time-grid" data-has-actual={hasActual}>
        <span aria-hidden="true" />
        {dates.map((date) => {
          const total = dayTotals.get(date) ?? 0;
          return <button key={date} type="button" aria-pressed={date === selectedDate}
            className="calendar-time-heading px-1 py-1.5 text-xs font-semibold" data-today={date === today}
            onClick={() => onSelect(date)}>
            <span className="block truncate">{formatKoreanDate(date, "E M/d")}</span>
            <span className={`block truncate text-[11px] font-normal tabular-nums ${timer?.dailyGoalMinutes && total >= timer.dailyGoalMinutes * 60_000 ? "font-semibold text-success" : "text-ui-muted"}`}>{total ? formatDuration(total) : " "}</span>
          </button>;
        })}
        <span className="pt-1 text-xs text-ui-muted">종일</span>
        {dates.map((date) => {
          const scheduled = todos.filter((todo) => !todo.archived && todo.planningState === "SCHEDULED" && todo.date === date
            && !weekBlocks.some(({ block }) => block.date === date && block.todoId === todo.id));
          const due = todos.filter((todo) => !todo.archived && todo.dueDate === date && !scheduled.includes(todo));
          return <div key={date} className="calendar-all-day" data-today={date === today}
            onDragOver={(event) => { if (event.dataTransfer.types.includes("text/plain")) event.preventDefault(); }}
            onDrop={(event) => {
              event.preventDefault();
              const todo = todos.find(({ id }) => id === event.dataTransfer.getData("text/plain"));
              if (todo) void onSchedule(todo, date);
            }}>
            {[...scheduled, ...due].map((todo) => <button key={todo.id} type="button"
              className={`block w-full truncate rounded-sm px-1 text-left text-xs ${todo.completed ? "line-through text-ui-muted" : "text-ui-text"}`}
              title={todo.title} draggable onDragStart={(event) => {
                event.dataTransfer.effectAllowed = "move";
                event.dataTransfer.setData("text/plain", todo.id);
              }} onClick={() => onOpenTodo(todo)}>{todo.dueDate === date ? "마감 · " : ""}{todo.title}</button>)}
          </div>;
        })}
        <div className="calendar-hour-labels text-xs text-ui-muted" aria-hidden="true">
          {hours.map((hour) => <span key={hour}>{clockLabel(hour * 60)}</span>)}
        </div>
        {dates.map((date) => <div key={date} className="calendar-time-day" data-today={date === today}
          onPointerDown={(event) => begin(event, date)} onPointerMove={move} onPointerUp={finish}
          onPointerCancel={() => { gesture.current = null; setSelection(null); }}
          onDragOver={(event) => { if (event.dataTransfer.types.includes("text/plain")) event.preventDefault(); }}
          onDrop={(event) => {
            event.preventDefault();
            const value = event.dataTransfer.getData("text/plain");
            const dragged = weekBlocks.find(({ block }) => value === `block:${block.id}`)?.block;
            const todo = todos.find(({ id }) => id === (dragged?.todoId ?? value));
            if (!dragged && !todo) return;
            const duration = clamp(dragged?.plannedMinutes ?? 30, STEP, winEnd - winStart);
            const start = clamp(minuteAt(event.currentTarget, event.clientY), winStart, winEnd - duration);
            void save({ title: dragged?.title ?? todo!.title, todoId: todo?.id ?? dragged?.todoId ?? undefined, completed: dragged?.completed,
              ...toBlockFields(date, start, start + duration) }, dragged, todo);
          }}>
          {weekBlocks.filter(({ column, start, end }) => column === date && end > winStart && start < winEnd).map(({ block, start: rawStart, end: rawEnd }) => {
            const start = Math.max(winStart, rawStart);
            const end = Math.min(winEnd, rawEnd);
            const todo = todos.find(({ id }) => id === block.todoId);
            const project = projects.find(({ id }) => id === todo?.projectId);
            return <div key={block.id} data-time-block draggable className="calendar-time-block"
              style={{ top: `${percent(start - winStart)}%`, height: `${percent(end - start)}%`, borderColor: getEntityColor(project, projects),
                background: `color-mix(in srgb, ${getEntityColor(project, projects)} 22%, var(--surface-1))` }}
              title={`${block.title} · ${block.startTime}–${block.endTime}`}
              onDragStart={(event) => {
                event.dataTransfer.effectAllowed = "move";
                event.dataTransfer.setData("text/plain", `block:${block.id}`);
              }}>
              {todo ? <button type="button" onClick={() => onOpenTodo(todo)} className="block w-full truncate text-left">{block.title}</button> : <span className="block truncate">{block.title}</span>}
              <span data-resize-block={block.id} className="calendar-time-resize" aria-hidden="true" />
            </div>;
          })}
          {allEntries.map((entry) => {
            const part = intervalOnDay(entry.startedAt, entry.endedAt, date);
            if (!part || part.end <= winStart || part.start >= winEnd) return null;
            const start = Math.max(winStart, part.start); const end = Math.min(winEnd, part.end);
            const running = entry.id === "active";
            const label = `${entryCategoryName(entry, categories)} · ${entry.title}`;
            return <button key={entry.id} type="button" data-time-actual data-running={running} disabled={running}
              className="calendar-time-actual" style={{ top: `${percent(start - winStart)}%`, height: `${percent(end - start)}%`, backgroundColor: entryColor(entry, categories) }}
              title={`${label} · ${formatDuration((part.end - part.start) * 60_000)}${running ? " · 측정 중" : ""}`}
              aria-label={running ? `${label} (측정 중)` : `${label} 수정`}
              onClick={() => setEditingEntry(entry)} />;
          })}
          {selection?.column === date ? <span className="calendar-time-selection" style={{
            top: `${percent(selection.start - winStart)}%`, height: `${percent(selection.end - selection.start)}%`,
          }} /> : null}
          {date === today && nowOffset >= winStart && nowOffset < winEnd ? <span className="calendar-now-line" style={{ top: `${percent(nowOffset - winStart)}%` }} /> : null}
        </div>)}
      </div>
      {editingEntry ? (
        <TimeEntryModal entry={editingEntry} categories={categories}
          defaultStart={editingEntry.startedAt} defaultEnd={editingEntry.endedAt}
          onClose={() => setEditingEntry(null)} onCreate={create} onUpdate={update} onDelete={remove} />
      ) : null}
    </section>
  );
}
