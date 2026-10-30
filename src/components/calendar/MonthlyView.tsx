import { useMemo, useRef, useState } from "react";
import { PanelRightOpen } from "lucide-react";
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
  todos: Todo[];
  projects?: Project[];
  milestones?: Milestone[];
  getTodosByDate: (date: string) => Todo[];
  onAdd: (todo: TodoInput) => Promise<Todo | undefined> | Todo | undefined;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onUpdate: (id: string, updates: Partial<Omit<Todo, "id" | "createdAt">>) => void;
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
  const [currentMonth, setCurrentMonth] = useState(() => parseDateKey(todayKey()));
  const [selectedDate, setSelectedDate] = useState(todayKey);
  const [panelOpen, setPanelOpen] = useState(false);
  const [visibility, setVisibility] = useState<CalendarVisibility>(defaultCalendarVisibility);
  const selectedPanelRef = useRef<HTMLDivElement | null>(null);
  const monthDays = useMemo(() => getMonthGrid(currentMonth), [currentMonth]);
  const events = useMemo(() => buildCalendarEvents(todos, projects, milestones), [todos, projects, milestones]);
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
    setSelectedDate(dateKey);
    const date = parseDateKey(dateKey);
    if (date.getMonth() !== currentMonth.getMonth() || date.getFullYear() !== currentMonth.getFullYear()) {
      setCurrentMonth(date);
    }
    setPanelOpen(true);
    if (window.innerWidth < 1280) {
      window.requestAnimationFrame(() => {
        selectedPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
  };

  const changeMonth = (date: Date) => {
    setCurrentMonth(date);
    setSelectedDate(toDateKey(date));
  };
  const goToToday = () => {
    const today = todayKey();
    setCurrentMonth(parseDateKey(today));
    setSelectedDate(today);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="캘린더 일정 필터">
          {filterOptions.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              aria-pressed={visibility[key]}
              onClick={() => setVisibility((current) => ({ ...current, [key]: !current[key] }))}
              className={`min-h-9 rounded-lg border px-3 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/60 ${
                visibility[key]
                  ? "border-ink-600 bg-ink-800 text-ink-100"
                  : "border-ink-700/70 bg-ink-950/60 text-ink-500 hover:text-ink-200"
              }`}
            >{label}</button>
          ))}
        </div>
        {!panelOpen ? (
          <button type="button" className="btn-secondary min-h-9 text-xs" onClick={() => setPanelOpen(true)}>
            <PanelRightOpen size={15} /> 선택한 날짜 보기
          </button>
        ) : null}
      </div>

      <div className={`grid min-w-0 items-start gap-4 ${panelOpen ? "xl:grid-cols-[minmax(0,1fr)_minmax(320px,360px)]" : ""}`}>
        <MonthlyCalendar
          currentMonth={currentMonth}
          monthDays={monthDays}
          selectedDate={selectedDate}
          goals={goals}
          eventsByDate={eventsByDate}
          onMonthChange={changeMonth}
          onToday={goToToday}
          onSelectDate={selectDate}
          onCycleDayStatus={cycleDayStatus}
        />
        {panelOpen ? (
          <div ref={selectedPanelRef} className="min-w-0 scroll-mt-24 xl:sticky xl:top-20 xl:self-start">
            <MonthlySidePanel
              selectedDate={selectedDate}
              monthEndLabel={selectedMonthEndLabel}
              selectedTodos={selectedTodos}
              selectedEvents={selectedEvents}
              categories={categories}
              onClose={() => setPanelOpen(false)}
              onAdd={onAdd}
              onToggle={onToggle}
              onDelete={onDelete}
              onUpdate={onUpdate}
              onAddCategory={onAddCategory}
              onUpdateCategory={onUpdateCategory}
              onDeleteCategory={onDeleteCategory}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
