import { useEffect, useRef, useState, type PointerEvent } from "react";
import { api, jsonBody } from "../../lib/api/client";
import { formatKoreanDate, todayKey } from "../../lib/date";
import { getEntityColor } from "../../lib/entityColor";
import type { Project } from "../../types/project";
import type { TimeBlock, TimeBlockInput } from "../../types/time";
import type { Todo } from "../../types/todo";

const startOfGrid = 9 * 60;
const endOfGrid = 19 * 60;
const step = 15;
const hours = Array.from({ length: 10 }, (_, index) => index + 9);
const minutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
const time = (value: number) => `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
const percent = (duration: number) => duration / (endOfGrid - startOfGrid) * 100;
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

type Props = {
  dates: string[];
  selectedDate: string;
  todos: Todo[];
  projects: Project[];
  onSelect: (date: string) => void;
  onOpenTodo: (todo: Todo) => void;
  onSchedule: (todo: Todo, date: string) => Promise<boolean>;
};

export function WeeklyTimetable({ dates, selectedDate, todos, projects, onSelect, onOpenTodo, onSchedule }: Props) {
  const [visible, setVisible] = useState(() => window.matchMedia("(min-width: 1280px)").matches);
  const [blocks, setBlocks] = useState<TimeBlock[]>([]);
  const [loadedWeek, setLoadedWeek] = useState("");
  const [now, setNow] = useState(() => new Date());
  const [error, setError] = useState("");
  const writeInProgress = useRef(false);
  const gesture = useRef<{ date: string; start: number; block?: TimeBlock } | null>(null);
  const [selection, setSelection] = useState<{ date: string; start: number; end: number } | null>(null);
  const weekStart = dates[0];
  const weekEnd = dates[6];
  const today = todayKey(now);
  const clock = now.getHours() * 60 + now.getMinutes();
  const weekBlocks = loadedWeek === weekStart ? blocks : [];

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
    void api<{ timeBlocks: TimeBlock[] }>(`/api/time-blocks?from=${weekStart}&to=${weekEnd}`)
      .then(({ timeBlocks }) => { if (live) { setBlocks(timeBlocks); setLoadedWeek(weekStart); } })
      .catch(() => { if (live) setError("시간 블록을 불러오지 못했습니다."); });
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => { live = false; window.clearInterval(timer); };
  }, [visible, weekStart, weekEnd]);

  const save = async (input: TimeBlockInput, block?: TimeBlock, todo?: Todo) => {
    if (writeInProgress.current || loadedWeek !== weekStart) return;
    writeInProgress.current = true;
    setError("");
    try {
      if (todo && (todo.date !== input.date || todo.planningState !== "SCHEDULED")) {
        if (!await onSchedule(todo, input.date)) throw new Error("할 일의 날짜를 변경하지 못했습니다.");
      }
      const path = block ? `/api/time-blocks/${block.id}` : "/api/time-blocks";
      const { timeBlock } = await api<{ timeBlock: TimeBlock }>(path, {
        method: block ? "PUT" : "POST", ...jsonBody(input),
      });
      setBlocks((items) => [...items.filter(({ id }) => id !== timeBlock.id), timeBlock]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "시간 블록을 저장하지 못했습니다.");
    } finally {
      writeInProgress.current = false;
    }
  };

  const minuteAt = (element: HTMLElement, clientY: number) => {
    const rect = element.getBoundingClientRect();
    const raw = startOfGrid + (clientY - rect.top) / rect.height * (endOfGrid - startOfGrid);
    return clamp(Math.round(raw / step) * step, startOfGrid, endOfGrid);
  };
  const begin = (event: PointerEvent<HTMLDivElement>, date: string) => {
    if (event.button !== 0 || loadedWeek !== weekStart) return;
    const target = event.target as HTMLElement;
    const resizeId = target.closest<HTMLElement>("[data-resize-block]")?.dataset.resizeBlock;
    const block = weekBlocks.find(({ id }) => id === resizeId);
    if (!block && target.closest("[data-time-block]")) return;
    const start = block ? minutes(block.startTime) : clamp(minuteAt(event.currentTarget, event.clientY), startOfGrid, endOfGrid - step);
    event.currentTarget.setPointerCapture(event.pointerId);
    gesture.current = { date, start, block };
    setSelection({ date, start: Math.max(startOfGrid, start), end: block ? minutes(block.endTime) : start + step });
  };
  const move = (event: PointerEvent<HTMLDivElement>) => {
    const current = gesture.current;
    if (!current) return;
    const point = minuteAt(event.currentTarget, event.clientY);
    const start = current.block ? current.start : Math.min(current.start, point);
    const end = Math.max(current.start + step, point);
    setSelection({ date: current.date, start: Math.max(startOfGrid, start), end });
  };
  const finish = (event: PointerEvent<HTMLDivElement>) => {
    const current = gesture.current;
    gesture.current = null;
    setSelection(null);
    if (!current) return;
    const point = minuteAt(event.currentTarget, event.clientY);
    const start = current.block ? current.start : Math.min(current.start, point);
    const end = Math.max(current.start + step, point);
    const block = current.block;
    void save({ title: block?.title ?? "시간 블록", todoId: block?.todoId ?? undefined, date: current.date,
      startTime: time(start), endTime: time(end), completed: block?.completed }, block);
  };

  if (!visible) return null;
  return (
    <section className="calendar-week-timetable min-w-0" aria-label="주간 시간표">
      {error ? <p role="alert" className="mb-2 text-xs text-danger">{error}</p> : null}
      <div className="calendar-time-grid">
        <span aria-hidden="true" />
        {dates.map((date) => <button key={date} type="button" aria-pressed={date === selectedDate}
          className="calendar-time-heading truncate px-1 py-2 text-xs font-semibold" data-today={date === today}
          onClick={() => onSelect(date)}>{formatKoreanDate(date, "E M/d")}</button>)}
        <span className="pt-1 text-xs text-ui-muted">종일</span>
        {dates.map((date) => {
          const scheduled = todos.filter((todo) => !todo.archived && todo.planningState === "SCHEDULED" && todo.date === date
            && !weekBlocks.some((block) => block.date === date && block.todoId === todo.id));
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
          {hours.map((hour) => <span key={hour}>{hour}:00</span>)}
        </div>
        {dates.map((date) => <div key={date} className="calendar-time-day" data-today={date === today}
          onPointerDown={(event) => begin(event, date)} onPointerMove={move} onPointerUp={finish}
          onPointerCancel={() => { gesture.current = null; setSelection(null); }}
          onDragOver={(event) => { if (event.dataTransfer.types.includes("text/plain")) event.preventDefault(); }}
          onDrop={(event) => {
            event.preventDefault();
            const value = event.dataTransfer.getData("text/plain");
            const block = weekBlocks.find(({ id }) => value === `block:${id}`);
            const todo = todos.find(({ id }) => id === (block?.todoId ?? value));
            if (!block && !todo) return;
            const duration = clamp(block?.plannedMinutes ?? 30, step, endOfGrid - startOfGrid);
            const start = clamp(minuteAt(event.currentTarget, event.clientY), startOfGrid, endOfGrid - duration);
            void save({ title: block?.title ?? todo!.title, todoId: todo?.id ?? block?.todoId ?? undefined, date,
              startTime: time(start), endTime: time(start + duration), completed: block?.completed }, block, todo);
          }}>
          {weekBlocks.filter((block) => block.date === date && minutes(block.endTime) > startOfGrid && minutes(block.startTime) < endOfGrid).map((block) => {
            const start = Math.max(startOfGrid, minutes(block.startTime));
            const end = Math.min(endOfGrid, minutes(block.endTime));
            const todo = todos.find(({ id }) => id === block.todoId);
            const project = projects.find(({ id }) => id === todo?.projectId);
            return <div key={block.id} data-time-block draggable className="calendar-time-block"
              style={{ top: `${percent(start - startOfGrid)}%`, height: `${percent(end - start)}%`, borderColor: getEntityColor(project, projects),
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
          {selection?.date === date ? <span className="calendar-time-selection" style={{
            top: `${percent(selection.start - startOfGrid)}%`, height: `${percent(selection.end - selection.start)}%`,
          }} /> : null}
          {date === today && clock >= startOfGrid && clock < endOfGrid ? <span className="calendar-now-line" style={{ top: `${percent(clock - startOfGrid)}%` }} /> : null}
        </div>)}
      </div>
    </section>
  );
}
