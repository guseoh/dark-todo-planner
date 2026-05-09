import { useMemo, useState } from "react";
import { CalendarCheck2, Plus, Trash2 } from "lucide-react";
import { calculateRate } from "../../lib/todo";
import { formatKoreanDate, getWeekDays, toDateKey, todayKey } from "../../lib/date";
import type { Todo, TodoInput } from "../../types/todo";
import type { Category } from "../../types/category";
import type { Goal } from "../../types/goal";
import { isDayStatusGoal } from "../../lib/goals";
import { GoalChecklist } from "../goal/GoalChecklist";
import { IconRenderer } from "../common/IconRenderer";
import { InlineTodoAdd } from "../todo/InlineTodoAdd";
import { PriorityBadge } from "../todo/PriorityBadge";

type WeeklyViewProps = {
  todos: Todo[];
  getTodosByDate: (date: string) => Todo[];
  onAdd: (todo: TodoInput) => void;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onUpdate: (id: string, updates: Partial<Omit<Todo, "id" | "createdAt">>) => void;
  onAddGoal: (input: Partial<Goal> & { title: string }) => void;
  onUpdateGoal: (id: string, updates: Partial<Omit<Goal, "id" | "createdAt">>) => void;
  onToggleGoal: (id: string) => void;
  onDeleteGoal: (id: string) => void;
  categories?: Category[];
  goals?: Goal[];
};

const weekendClass = (dayIndex: number) => {
  if (dayIndex === 5) return "border-sky-500/25 bg-sky-500/5";
  if (dayIndex === 6) return "border-rose-500/25 bg-rose-500/5";
  return "border-ink-700 bg-ink-800/85";
};

export function WeeklyView({
  todos,
  getTodosByDate,
  onAdd,
  onToggle,
  onDelete,
  onAddGoal,
  onUpdateGoal,
  onToggleGoal,
  onDeleteGoal,
  goals = [],
}: WeeklyViewProps) {
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set());
  const [addingDate, setAddingDate] = useState<string | null>(null);
  const weekDays = useMemo(() => getWeekDays(), []);
  const weekStart = toDateKey(weekDays[0]);
  const weekEnd = toDateKey(weekDays[6]);
  const weekRate = calculateRate(todos);
  const weeklyGoals = goals.filter(
    (goal) =>
      goal.type === "WEEKLY" &&
      (!goal.weekStartDate || goal.weekStartDate <= weekEnd) &&
      (!goal.weekEndDate || goal.weekEndDate >= weekStart),
  );
  const completedWeeklyGoals = weeklyGoals.filter((goal) => goal.completed).length;
  const activeWeeklyGoals = weeklyGoals.length - completedWeeklyGoals;

  const toggleExpanded = (date: string) => {
    setExpandedDates((current) => {
      const next = new Set(current);
      if (next.has(date)) next.delete(date);
      else next.add(date);
      return next;
    });
  };

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

      <section className="app-card space-y-3 p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-ink-100">
              <CalendarCheck2 size={18} className="text-accent-400" />
              <h3 className="text-base font-bold">주간 To-do list</h3>
            </div>
            <p className="mt-1 text-xs text-ink-500">요일별 Todo를 체크리스트처럼 바로 확인합니다.</p>
          </div>
          <span className="rounded-full border border-ink-700 bg-ink-950/70 px-2 py-0.5 text-xs text-ink-400">
            {todos.length}개 Todo
          </span>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-7">
          {weekDays.map((day, index) => {
            const dateKey = toDateKey(day);
            const dayTodos = getTodosByDate(dateKey);
            const activeCount = dayTodos.filter((todo) => !todo.completed).length;
            const completedCount = dayTodos.length - activeCount;
            const dayGoals = goals.filter((goal) => goal.type === "DAILY" && !isDayStatusGoal(goal) && (goal.targetDate === dateKey || goal.dueDate === dateKey));
            const isToday = dateKey === todayKey();
            const expanded = expandedDates.has(dateKey);
            const visibleTodos = expanded ? dayTodos : dayTodos.slice(0, 6);
            const hiddenCount = Math.max(dayTodos.length - visibleTodos.length, 0);

            return (
              <article
                key={dateKey}
                className={`flex min-h-64 min-w-0 flex-col rounded-xl border p-3 transition ${weekendClass(index)} ${
                  isToday ? "ring-2 ring-accent-500/45" : ""
                }`}
              >
                <div className="mb-2 flex items-start justify-between gap-2 border-b border-ink-700/70 pb-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <h4 className="whitespace-nowrap text-sm font-bold text-ink-100">{formatKoreanDate(day, "E요일")}</h4>
                      {isToday ? <span className="rounded-full bg-accent-500 px-2 py-0.5 text-[10px] font-bold text-white">오늘</span> : null}
                    </div>
                    <p className="mt-0.5 text-xs text-ink-500">{formatKoreanDate(day, "M월 d일")}</p>
                  </div>
                  <span className="shrink-0 rounded-full border border-ink-700 bg-ink-950/70 px-2 py-0.5 text-[11px] font-semibold text-ink-300">
                    {dayTodos.length}개
                  </span>
                </div>

                <div className="mb-2 flex flex-wrap gap-1">
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

                <div className="min-h-0 flex-1 space-y-1.5">
                  {visibleTodos.length ? (
                    visibleTodos.map((todo) => (
                      <div key={todo.id} className="group flex min-w-0 items-center gap-1.5 rounded-lg border border-ink-800 bg-ink-950/35 px-2 py-1.5 hover:border-ink-600">
                        <button
                          type="button"
                          className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                            todo.completed ? "border-success bg-success" : "border-ink-600 hover:border-accent-400"
                          }`}
                          onClick={() => onToggle(todo.id)}
                          aria-label={todo.completed ? "미완료로 변경" : "완료로 변경"}
                        />
                        <IconRenderer icon={todo.category?.icon} color={todo.category?.color || "#64748b"} name={todo.category?.name || "미분류"} className="h-4 w-4" />
                        <button type="button" className="min-w-0 flex-1 text-left" title={todo.title}>
                          <span className={`block truncate text-xs font-semibold ${todo.completed ? "text-ink-500 line-through" : "text-ink-100"}`}>
                            {todo.title}
                          </span>
                        </button>
                        <PriorityBadge priority={todo.priority} compact />
                        <button
                          type="button"
                          className="hidden h-6 w-6 shrink-0 items-center justify-center rounded-md border border-ink-800 text-ink-500 hover:border-danger hover:text-red-100 group-hover:flex"
                          onClick={() => window.confirm(`"${todo.title}" Todo를 삭제할까요?`) && onDelete(todo.id)}
                          aria-label="Todo 삭제"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-lg border border-dashed border-ink-800 bg-ink-950/25 px-3 py-3 text-center">
                      <p className="text-xs font-semibold text-ink-500">계획 없음</p>
                    </div>
                  )}

                  {hiddenCount ? (
                    <button
                      type="button"
                      className="flex min-h-8 w-full items-center justify-center rounded-lg border border-ink-700 bg-ink-950/45 px-3 text-xs font-semibold text-ink-400 transition hover:border-accent-500/60 hover:bg-ink-900 hover:text-ink-100"
                      onClick={() => toggleExpanded(dateKey)}
                    >
                      +{hiddenCount}개 더보기
                    </button>
                  ) : expanded && dayTodos.length > 6 ? (
                    <button
                      type="button"
                      className="flex min-h-8 w-full items-center justify-center rounded-lg border border-ink-700 bg-ink-950/45 px-3 text-xs font-semibold text-ink-400 transition hover:border-accent-500/60 hover:bg-ink-900 hover:text-ink-100"
                      onClick={() => toggleExpanded(dateKey)}
                    >
                      접기
                    </button>
                  ) : null}
                </div>

                <div className="mt-2 border-t border-ink-700/70 pt-2">
                  {addingDate === dateKey ? (
                    <InlineTodoAdd defaultDate={dateKey} onAdd={onAdd} onCancel={() => setAddingDate(null)} />
                  ) : (
                    <button
                      type="button"
                      className="flex min-h-8 w-full items-center justify-center gap-1 rounded-lg border border-dashed border-ink-700 px-2 text-xs font-semibold text-ink-400 transition hover:border-accent-500/60 hover:bg-ink-900/60 hover:text-ink-100"
                      onClick={() => setAddingDate(dateKey)}
                    >
                      <Plus size={13} /> 추가
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
