import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { calculateRate } from "../../lib/todo";
import { formatKoreanDate, getWeekDays, toDateKey, todayKey } from "../../lib/date";
import type { Todo, TodoInput } from "../../types/todo";
import type { Category } from "../../types/category";
import type { Goal } from "../../types/goal";
import { ProgressBar } from "../common/ProgressBar";
import { TodoForm } from "../todo/TodoForm";
import { TodoList } from "../todo/TodoList";
import { PriorityBadge } from "../todo/PriorityBadge";

type WeeklyViewProps = {
  todos: Todo[];
  getTodosByDate: (date: string) => Todo[];
  onAdd: (todo: TodoInput) => void;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onUpdate: (id: string, updates: Partial<Omit<Todo, "id" | "createdAt">>) => void;
  onArchive: (id: string) => void;
  onFocusTodo: (todo: Todo) => void;
  categories?: Category[];
  goals?: Goal[];
};

export function WeeklyView({ todos, getTodosByDate, onAdd, onToggle, onDelete, onUpdate, onArchive, onFocusTodo, categories = [], goals = [] }: WeeklyViewProps) {
  const [selectedDate, setSelectedDate] = useState(todayKey());
  const weekDays = useMemo(() => getWeekDays(), []);
  const weekStart = toDateKey(weekDays[0]);
  const weekEnd = toDateKey(weekDays[6]);
  const selectedTodos = getTodosByDate(selectedDate);
  const weekRate = calculateRate(todos);
  const weeklyGoals = goals.filter(
    (goal) =>
      goal.type === "WEEKLY" &&
      (!goal.weekStartDate || goal.weekStartDate <= weekEnd) &&
      (!goal.weekEndDate || goal.weekEndDate >= weekStart),
  );
  const weeklyGoalRate = weeklyGoals.length
    ? Math.round(weeklyGoals.reduce((sum, goal) => sum + goal.progress, 0) / weeklyGoals.length)
    : 0;

  return (
    <div className="space-y-5">
      <section className="app-card p-5">
        <div className="grid gap-5 lg:grid-cols-2">
          <div>
            <p className="text-sm text-ink-400">이번 주 완료율</p>
            <h2 className="mt-1 text-2xl font-bold text-ink-100">{weekRate}%</h2>
            <div className="mt-3">
              <ProgressBar value={weekRate} label={`${todos.length}개 중 ${todos.filter((todo) => todo.completed).length}개 완료`} />
            </div>
          </div>
          <div>
            <p className="text-sm text-ink-400">이번 주 목표</p>
            <h2 className="mt-1 text-2xl font-bold text-ink-100">{weeklyGoals.length ? `${weeklyGoalRate}%` : "-"}</h2>
            {weeklyGoals.length ? (
              <div className="mt-3 space-y-3">
                <ProgressBar value={weeklyGoalRate} label={`${weeklyGoals.length}개 주간 목표`} />
                <div className="flex flex-wrap gap-2">
                  {weeklyGoals.slice(0, 3).map((goal) => (
                    <span key={goal.id} className="rounded-full border border-ink-700 bg-ink-950/60 px-3 py-1 text-xs text-ink-200">
                      {goal.title}
                    </span>
                  ))}
                </div>
              </div>
            ) : (
              <p className="mt-3 text-sm text-ink-500">이번 주 목표가 없습니다.</p>
            )}
          </div>
        </div>
      </section>

      <section className="grid gap-3 xl:grid-cols-7">
        {weekDays.map((day) => {
          const dateKey = toDateKey(day);
          const dayTodos = getTodosByDate(dateKey);
          const activeCount = dayTodos.filter((todo) => !todo.completed).length;
          const isToday = dateKey === todayKey();
          const isSelected = dateKey === selectedDate;

          return (
            <button
              key={dateKey}
              type="button"
              onClick={() => setSelectedDate(dateKey)}
              className={`app-card min-h-48 p-4 text-left transition hover:border-accent-500/60 ${
                isSelected ? "border-accent-500/70 bg-accent-500/10" : ""
              } ${isToday ? "ring-2 ring-accent-500/60" : ""}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-ink-100">{formatKoreanDate(day, "E요일")}</p>
                    {isToday ? (
                      <span className="rounded-full bg-accent-500 px-2 py-0.5 text-[11px] font-bold text-white">
                        오늘
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-xs text-ink-400">{formatKoreanDate(day, "M월 d일")}</p>
                </div>
                <span className={`rounded-full border px-2 py-1 text-xs font-semibold ${
                  activeCount
                    ? "border-warning/45 bg-warning/15 text-amber-100"
                    : "border-success/45 bg-success/15 text-emerald-100"
                }`}>
                  미완료 {activeCount}
                </span>
              </div>
              <div className="mt-4 space-y-2">
                {dayTodos.slice(0, 4).map((todo) => (
                  <div key={todo.id} className={`rounded-md border border-ink-700 bg-ink-950/50 p-2 ${todo.completed ? "opacity-50" : ""}`}>
                    <div className="flex min-w-0 items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: todo.category?.color || "#475569" }}
                        aria-hidden="true"
                      />
                      <p className={`truncate text-sm font-medium text-ink-100 ${todo.completed ? "line-through" : ""}`}>{todo.title}</p>
                    </div>
                    <div className="mt-2">
                      <PriorityBadge priority={todo.priority} />
                    </div>
                  </div>
                ))}
                {dayTodos.length === 0 ? <p className="text-sm text-ink-500">계획 없음</p> : null}
                {dayTodos.length > 4 ? <p className="text-xs text-ink-500">+{dayTodos.length - 4}개 더 있음</p> : null}
              </div>
            </button>
          );
        })}
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Plus size={18} className="text-accent-400" />
            <h3 className="font-semibold text-ink-100">{formatKoreanDate(selectedDate, "M월 d일 EEEE")}에 추가</h3>
          </div>
          <TodoForm onAdd={onAdd} defaultDate={selectedDate} compact categories={categories} />
        </div>
        <div className="space-y-4">
          <h3 className="font-semibold text-ink-100">선택한 날짜 Todo</h3>
          <TodoList
            todos={selectedTodos}
            onToggle={onToggle}
            onDelete={onDelete}
            onUpdate={onUpdate}
            onArchive={onArchive}
            onFocusTodo={onFocusTodo}
            categories={categories}
            emptyTitle="이번 주 계획이 없습니다."
            emptyDescription="선택한 날짜에 새로운 Todo를 추가해보세요."
            groupByCompletion
            showDate={false}
          />
        </div>
      </section>
    </div>
  );
}
