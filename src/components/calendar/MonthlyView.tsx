import { useMemo, useRef, useState } from "react";
import { getMonthGrid, todayKey } from "../../lib/date";
import type { Todo, TodoInput } from "../../types/todo";
import type { Category } from "../../types/category";
import type { Goal } from "../../types/goal";
import { DAY_STATUS_GOAL_TITLE, getDayStatusGoal } from "../../lib/goals";
import { MonthlyCalendar } from "../monthly/MonthlyCalendar";
import { MonthlySidePanel } from "../monthly/MonthlySidePanel";

type MonthlyViewProps = {
  todos: Todo[];
  getTodosByDate: (date: string) => Todo[];
  onAdd: (todo: TodoInput) => void;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onUpdate: (id: string, updates: Partial<Omit<Todo, "id" | "createdAt">>) => void;
  onArchive: (id: string) => void;
  categories?: Category[];
  goals?: Goal[];
  onAddGoal: (input: Partial<Goal> & { title: string }) => void;
  onUpdateGoal: (id: string, updates: Partial<Omit<Goal, "id" | "createdAt">>) => void;
  onToggleGoal: (id: string) => void;
  onDeleteGoal: (id: string) => void;
  onAddCategory: (input: { name: string; description?: string; color?: string }) => void | Promise<void>;
  onUpdateCategory: (id: string, input: Partial<Category>) => void | Promise<void>;
  onDeleteCategory: (id: string, mode: "moveTodos" | "deleteTodos") => void | Promise<void>;
};

export function MonthlyView({
  todos,
  getTodosByDate,
  onAdd,
  onToggle,
  onDelete,
  onUpdate,
  onArchive,
  categories = [],
  goals = [],
  onAddGoal,
  onUpdateGoal,
  onToggleGoal,
  onDeleteGoal,
  onAddCategory,
  onUpdateCategory,
  onDeleteCategory,
}: MonthlyViewProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(todayKey());
  const selectedPanelRef = useRef<HTMLDivElement | null>(null);
  const monthDays = useMemo(() => getMonthGrid(currentMonth), [currentMonth]);
  const selectedTodos = getTodosByDate(selectedDate);

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
    if (window.innerWidth < 1280) {
      window.requestAnimationFrame(() => {
        selectedPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
  };

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.75fr)_minmax(340px,0.82fr)] 2xl:grid-cols-[minmax(0,1.95fr)_minmax(360px,0.75fr)]">
      <MonthlyCalendar
        currentMonth={currentMonth}
        monthDays={monthDays}
        selectedDate={selectedDate}
        goals={goals}
        getTodosByDate={getTodosByDate}
        onMonthChange={setCurrentMonth}
        onSelectDate={selectDate}
        onCycleDayStatus={cycleDayStatus}
      />

      <div ref={selectedPanelRef}>
        <MonthlySidePanel
          currentMonth={currentMonth}
          selectedDate={selectedDate}
          selectedTodos={selectedTodos}
          categories={categories}
          goals={goals}
          onAdd={onAdd}
          onToggle={onToggle}
          onDelete={onDelete}
          onUpdate={onUpdate}
          onArchive={onArchive}
          onAddGoal={onAddGoal}
          onUpdateGoal={onUpdateGoal}
          onToggleGoal={onToggleGoal}
          onDeleteGoal={onDeleteGoal}
          onAddCategory={onAddCategory}
          onUpdateCategory={onUpdateCategory}
          onDeleteCategory={onDeleteCategory}
        />
      </div>
    </div>
  );
}
