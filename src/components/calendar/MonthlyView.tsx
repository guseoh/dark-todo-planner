import { UnscheduledCalendarTodos } from "./UnscheduledCalendarTodos";
import { useEffect, useMemo, useRef, useState } from "react";
import { Check, PanelRightOpen } from "lucide-react";
import { TodoEditModal } from "../todo/TodoEditModal";
import {
  buildCalendarEvents,
  defaultCalendarVisibility,
  groupCalendarEvents,
  type CalendarVisibility,
} from "../../lib/calendarEvents";
import { getMonthEndLabel, getMonthGrid, parseDateKey, todayKey, toDateKey } from "../../lib/date";
import type { Todo, TodoInput } from "../../types/todo";
import type { Category } from "../../types/category";
import type { Goal } from "../../types/goal";
import type { Milestone, Project } from "../../types/project";
import { DAY_STATUS_GOAL_TITLE, getDayStatusGoal } from "../../lib/goals";
import { MonthlyCalendar } from "../monthly/MonthlyCalendar";
import { MonthlySidePanel } from "../monthly/MonthlySidePanel";

type MonthlyViewProps = {
  selectedDate: string;
  onSelectDate: (date: string) => void;
  todos: Todo[];
  projects?: Project[];
  milestones?: Milestone[];
  getTodosByDate: (date: string) => Todo[];
  onAdd: (todo: TodoInput) => Promise<Todo | undefined> | Todo | undefined;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onUpdate: (id: string, updates: Partial<Omit<Todo, "id" | "createdAt">>) => Promise<Todo | undefined> | Todo | undefined;
  categories?: Category[];
  goals?: Goal[];
  onAddGoal: (input: Partial<Goal> & { title: string }) => void;
  onToggleGoal: (id: string) => void;
  onDeleteGoal: (id: string) => void;
  onAddCategory: (input: { name: string; description?: string; color?: string; icon?: string }) => void | Promise<void>;
  onUpdateCategory: (id: string, input: Partial<Category>) => void | Promise<void>;
  onDeleteCategory: (id: string, mode: "moveTodos" | "deleteTodos") => void | Promise<void>;
};

const filterOptions: Array<{ key: keyof CalendarVisibility; label: string }> = [
  { key: "todo", label: "Todo" },
  { key: "deadline", label: "마감일" },
  { key: "project", label: "프로젝트·마일스톤" },
];

export function MonthlyView({
  selectedDate,
  onSelectDate,
  todos,
  projects = [],
  milestones = [],
  getTodosByDate,
  onAdd,
  onToggle,
  onDelete,
  onUpdate,
  categories = [],
  goals = [],
  onAddGoal,
  onToggleGoal,
  onDeleteGoal,
  onAddCategory,
  onUpdateCategory,
  onDeleteCategory,
}: MonthlyViewProps) {
  const currentMonth = useMemo(() => parseDateKey(selectedDate.slice(0, 7) + "-01"), [selectedDate]);
  const [panelOpen, setPanelOpen] = useState(false);
  const [quickAdd, setQuickAdd] = useState(false);
  const [editingTodoId, setEditingTodoId] = useState<string | null>(null);
  const [movingTodoId, setMovingTodoId] = useState<string | null>(null);
  const [moveFeedback, setMoveFeedback] = useState<{ kind: "error" | "success"; message: string } | null>(null);
  const [visibility, setVisibility] = useState<CalendarVisibility>(defaultCalendarVisibility);
  const selectedPanelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!panelOpen) return;
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setPanelOpen(false); setQuickAdd(false); }
    };
    window.addEventListener("keydown", onEscape);
    return () => window.removeEventListener("keydown", onEscape);
  }, [panelOpen]);
  const monthDays = useMemo(() => getMonthGrid(currentMonth), [currentMonth]);
  const events = useMemo(() => buildCalendarEvents(todos, projects, milestones, categories), [todos, projects, milestones, categories]);
  const eventsByDate = useMemo(() => groupCalendarEvents(events, visibility), [events, visibility]);
  const selectedEvents = eventsByDate.get(selectedDate) ?? [];
  const selectedTodos = getTodosByDate(selectedDate);
  const selectedMonthEndLabel = getMonthEndLabel(parseDateKey(selectedDate), currentMonth);

  const cycleDayStatus = (dateKey: string) => {
    const statusGoal = getDayStatusGoal(goals, dateKey);
    if (!statusGoal) {
      onAddGoal({
        title: DAY_STATUS_GOAL_TITLE,
        type: "DAILY",
        targetDate: dateKey,
        dueDate: dateKey,
        progress: 100,
        completed: true,
      });
      return;
    }
    if (statusGoal.completed) {
      onToggleGoal(statusGoal.id);
      return;
    }
    onDeleteGoal(statusGoal.id);
  };

  const selectDate = (dateKey: string) => {
    onSelectDate(dateKey);
    setPanelOpen(true);
    setQuickAdd(false);
    window.requestAnimationFrame(() => selectedPanelRef.current?.focus());
  };

  const openQuickAdd = (dateKey: string) => {
    selectDate(dateKey);
    setQuickAdd(true);
  };
  const moveTodo = async (id: string, dateKey: string): Promise<boolean> => {
    const original = todos.find((todo) => todo.id === id);
    if (!original || original.archived || original.date === dateKey || movingTodoId) return false;
    setMovingTodoId(id);
    setMoveFeedback(null);
    try {
      const result = await onUpdate(id, { date: dateKey, planningState: "SCHEDULED" });
      if (!result) {
        setMoveFeedback({ kind: "error", message: `“${original.title}”의 날짜 변경에 실패했습니다. 기존 날짜가 유지됩니다.` });
        return false;
      }
      setMoveFeedback({ kind: "success", message: `“${original.title}”을 ${dateKey}로 이동했습니다.` });
      return true;
    } catch {
      setMoveFeedback({ kind: "error", message: `“${original.title}”의 날짜 변경에 실패했습니다. 기존 날짜가 유지됩니다.` });
      return false;
    } finally {
      setMovingTodoId(null);
    }
  };

  const changeMonth = (date: Date) => {
    onSelectDate(toDateKey(date));
  };
  const goToToday = () => {
    onSelectDate(todayKey());
  };

  return (
    <div className="calendar-month-workspace w-full min-w-0 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="캘린더 일정 필터">
          {filterOptions.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              aria-pressed={visibility[key]}
              onClick={() => setVisibility((current) => ({ ...current, [key]: !current[key] }))}
              className={`calendar-filter-chip inline-flex min-h-9 items-center gap-1.5 rounded-[4px] border px-3 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/60 ${
                visibility[key]
                  ? "border-ui-focus bg-ui-selected text-ui-text"
                  : "border-dashed border-ui-divider bg-transparent text-ink-500 hover:text-ui-secondary"
              }`}
            >{visibility[key] ? <Check size={13} aria-hidden="true" /> : null}{label}</button>
          ))}
        </div>
        <span className="hidden text-xs text-ui-muted xl:inline-flex"><span className="mr-1 text-success" aria-hidden="true">●</span>기록한 날</span>
        {!panelOpen ? (
          <button type="button" className="calendar-open-day btn-secondary min-h-9 text-xs" onClick={() => setPanelOpen(true)}>
            <PanelRightOpen size={15} /> 선택한 날짜 보기
          </button>
        ) : null}
      </div>

      {moveFeedback ? <p role={moveFeedback.kind === "error" ? "alert" : "status"} className={`border-l-2 py-2 pl-3 text-xs ${moveFeedback.kind === "error" ? "border-danger/60 text-danger" : "border-success/60 text-ui-secondary"}`}>{moveFeedback.message}</p> : null}
      <div className="calendar-v4-month-stage min-w-0">
        <MonthlyCalendar
          currentMonth={currentMonth}
          monthDays={monthDays}
          selectedDate={selectedDate}
          goals={goals}
          eventsByDate={eventsByDate}
          rangeEvents={visibility.project ? events.filter(({ startDate }) => startDate) : []}
          onMonthChange={changeMonth}
          onToday={goToToday}
          onSelectDate={selectDate}
          onCycleDayStatus={cycleDayStatus}
          onQuickAdd={openQuickAdd}
          onOpenTodo={setEditingTodoId}
          onMoveTodo={(id, date) => { void moveTodo(id, date); }}
          draggingDisabled={Boolean(movingTodoId)}
        />
        <div className={`calendar-month-right ${panelOpen ? "is-open" : ""}`}>
          <button type="button" className="calendar-v4-date-backdrop" aria-label="날짜 상세 바깥 영역 닫기"
            onClick={() => { setPanelOpen(false); setQuickAdd(false); }} />
          <div ref={selectedPanelRef} tabIndex={-1}
            className="calendar-month-panel calendar-v4-date-drawer min-w-0">
            <UnscheduledCalendarTodos todos={todos} />
            <MonthlySidePanel
              selectedDate={selectedDate}
              monthEndLabel={selectedMonthEndLabel}
              selectedTodos={selectedTodos}
              selectedEvents={selectedEvents}
              categories={categories}
              quickAdd={quickAdd}
              onCancelQuickAdd={() => setQuickAdd(false)}
              onStartQuickAdd={() => openQuickAdd(selectedDate)}
              movingTodoId={movingTodoId}
              onMoveTodo={moveTodo}
              onClose={() => { setPanelOpen(false); setQuickAdd(false); }}
              onAdd={onAdd}
              onToggle={onToggle}
              onDelete={onDelete}
              onUpdate={onUpdate}
              onAddCategory={onAddCategory}
              onUpdateCategory={onUpdateCategory}
              onDeleteCategory={onDeleteCategory}
            />
          </div>
        </div>
      </div>
      <TodoEditModal
        todo={todos.find((todo) => todo.id === editingTodoId) ?? null}
        categories={categories}
        projects={projects}
        onClose={() => setEditingTodoId(null)}
        onSave={onUpdate}
      />
    </div>
  );
}
