import { useMemo, useState } from "react";
import { CalendarCheck2, Plus } from "lucide-react";
import { calculateRate } from "../../lib/todo";
import { formatKoreanDate, getWeekDays, toDateKey, todayKey } from "../../lib/date";
import type { Todo, TodoInput } from "../../types/todo";
import type { Category } from "../../types/category";
import type { Goal } from "../../types/goal";
import { isDayStatusGoal } from "../../lib/goals";
import { GoalChecklist } from "../goal/GoalChecklist";
import { GroupedTodoList } from "../todo/GroupedTodoList";
import { TodoForm } from "../todo/TodoForm";

type WeeklyViewProps = {
  todos: Todo[];
  getTodosByDate: (date: string) => Todo[];
  onAdd: (todo: TodoInput) => void;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onUpdate: (id: string, updates: Partial<Omit<Todo, "id" | "createdAt">>) => void;
  onArchive: (id: string) => void;
  onAddGoal: (input: Partial<Goal> & { title: string }) => void;
  onUpdateGoal: (id: string, updates: Partial<Omit<Goal, "id" | "createdAt">>) => void;
  onToggleGoal: (id: string) => void;
  onDeleteGoal: (id: string) => void;
  categories?: Category[];
  goals?: Goal[];
};

export function WeeklyView({
  todos,
  getTodosByDate,
  onAdd,
  onToggle,
  onDelete,
  onUpdate,
  onArchive,
  onAddGoal,
  onUpdateGoal,
  onToggleGoal,
  onDeleteGoal,
  categories = [],
  goals = [],
}: WeeklyViewProps) {
  const [selectedDate, setSelectedDate] = useState(todayKey());
  const weekDays = useMemo(() => getWeekDays(), []);
  const weekStart = toDateKey(weekDays[0]);
  const weekEnd = toDateKey(weekDays[6]);
  const weekRate = calculateRate(todos);
  const selectedTodos = getTodosByDate(selectedDate);
  const weeklyGoals = goals.filter(
    (goal) =>
      goal.type === "WEEKLY" &&
      (!goal.weekStartDate || goal.weekStartDate <= weekEnd) &&
      (!goal.weekEndDate || goal.weekEndDate >= weekStart),
  );
  const completedWeeklyGoals = weeklyGoals.filter((goal) => goal.completed).length;
  const activeWeeklyGoals = weeklyGoals.length - completedWeeklyGoals;

  return (
    <div className="space-y-4">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "이번 주", value: `${formatKoreanDate(weekStart, "M.d")} ~ ${formatKoreanDate(weekEnd, "M.d")}` },
          { label: "주간 목표", value: `${weeklyGoals.length}개` },
          { label: "완료 / 미완료", value: `${completedWeeklyGoals} / ${activeWeeklyGoals}` },
          { label: "Todo 완료율", value: `${weekRate}%` },
        ].map((item) => (
          <article key={item.label} className="app-card p-3">
            <p className="text-xs font-semibold text-ink-500">{item.label}</p>
            <p className="mt-1 text-lg font-bold text-ink-100">{item.value}</p>
          </article>
        ))}
      </section>

      <GoalChecklist
        title="이번 주 목표"
        subtitle={`${formatKoreanDate(weekStart, "yyyy.MM.dd")} ~ ${formatKoreanDate(weekEnd, "yyyy.MM.dd")}`}
        goals={weeklyGoals}
        type="WEEKLY"
        addDefaults={{ weekStartDate: weekStart, weekEndDate: weekEnd, dueDate: weekEnd }}
        placeholder="이번 주 목표"
        emptyTitle="이번 주 목표가 없습니다."
        onAdd={onAddGoal}
        onUpdate={onUpdateGoal}
        onToggle={onToggleGoal}
        onDelete={onDeleteGoal}
      />

      <section className="grid gap-4 2xl:grid-cols-[minmax(0,1.28fr)_minmax(340px,0.72fr)]">
        <div className="grid gap-2 md:grid-cols-7">
          {weekDays.map((day) => {
            const dateKey = toDateKey(day);
            const dayTodos = getTodosByDate(dateKey);
            const activeCount = dayTodos.filter((todo) => !todo.completed).length;
            const completedCount = dayTodos.length - activeCount;
            const dayGoals = goals.filter((goal) => goal.type === "DAILY" && !isDayStatusGoal(goal) && (goal.targetDate === dateKey || goal.dueDate === dateKey));
            const categoryColors = Array.from(new Set(dayTodos.map((todo) => todo.category?.color).filter(Boolean))).slice(0, 3);
            const isToday = dateKey === todayKey();
            const isSelected = dateKey === selectedDate;
            const statusText = dayTodos.length ? `할 일 ${dayTodos.length}개` : dayGoals.length ? "목표만 있음" : "계획 없음";

            return (
              <button
                key={dateKey}
                type="button"
                onClick={() => setSelectedDate(dateKey)}
                className={`min-h-24 rounded-lg border p-2.5 text-left transition hover:border-accent-500/60 md:min-h-32 xl:min-h-28 ${
                  isSelected ? "border-accent-500/70 bg-accent-500/10" : "border-ink-700 bg-ink-800/85"
                } ${isToday ? "ring-2 ring-accent-500/50" : ""}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p className="whitespace-nowrap text-sm font-bold text-ink-100">{formatKoreanDate(day, "E요일")}</p>
                      {isToday ? <span className="rounded-full bg-accent-500 px-2 py-0.5 text-[11px] font-bold text-white">오늘</span> : null}
                    </div>
                    <p className="mt-1 text-xs text-ink-400">{formatKoreanDate(day, "M월 d일")}</p>
                  </div>
                </div>
                <p className="mt-2 text-sm font-semibold text-ink-200">{statusText}</p>
                <div className="mt-1.5 flex flex-wrap gap-1">
                  <span className="rounded-full border border-warning/40 bg-warning/10 px-2 py-0.5 text-[11px] font-semibold text-amber-100">
                    미완료 {activeCount}
                  </span>
                  <span className="rounded-full border border-success/40 bg-success/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-100">
                    완료 {completedCount}
                  </span>
                  {dayGoals.length ? (
                    <span className="rounded-full border border-accent-500/35 bg-accent-500/10 px-2 py-0.5 text-[11px] font-semibold text-indigo-100">
                      목표 {dayGoals.length}
                    </span>
                  ) : null}
                </div>
                {categoryColors.length ? (
                  <div className="mt-2 flex items-center gap-1.5">
                    {categoryColors.map((color) => (
                      <span key={color} className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} aria-hidden="true" />
                    ))}
                  </div>
                ) : null}
              </button>
            );
          })}
        </div>

        <aside className="app-card p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <CalendarCheck2 size={17} className="text-accent-400" />
              <h3 className="truncate font-semibold text-ink-100">{formatKoreanDate(selectedDate, "M월 d일 EEEE")}</h3>
            </div>
            <span className="rounded-full border border-ink-700 bg-ink-950/70 px-2 py-0.5 text-xs text-ink-400">
              {selectedTodos.length}개
            </span>
          </div>
          <GroupedTodoList
            todos={selectedTodos}
            categories={categories}
            onAddTodo={onAdd}
            onToggle={onToggle}
            onDelete={onDelete}
            onUpdate={onUpdate}
            onArchive={onArchive}
            emptyTitle="선택한 날짜의 Todo가 없습니다."
            emptyDescription="아래 빠른 추가로 계획을 넣을 수 있습니다."
            showDate={false}
            defaultDate={selectedDate}
            showCategoryCreator={false}
            layout="list"
          />
          <div className="mt-3 border-t border-ink-700/70 pt-3">
            <div className="mb-2 flex items-center gap-2">
              <Plus size={16} className="text-accent-400" />
              <h4 className="text-sm font-semibold text-ink-100">선택 날짜 빠른 추가</h4>
            </div>
            <TodoForm onAdd={onAdd} defaultDate={selectedDate} compact categories={categories} submitLabel="추가" />
          </div>
        </aside>
      </section>
    </div>
  );
}
