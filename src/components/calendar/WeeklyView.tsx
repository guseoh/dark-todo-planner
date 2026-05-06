import { FormEvent, useMemo, useState } from "react";
import { CheckCircle2, Plus, Target, Trash2 } from "lucide-react";
import { calculateRate, priorityLabel } from "../../lib/todo";
import { formatKoreanDate, getWeekDays, toDateKey, todayKey } from "../../lib/date";
import type { Todo, TodoInput } from "../../types/todo";
import type { Category } from "../../types/category";
import type { Goal } from "../../types/goal";
import { TodoForm } from "../todo/TodoForm";

type WeeklyViewProps = {
  todos: Todo[];
  getTodosByDate: (date: string) => Todo[];
  focusStats?: {
    weekMinutes: number;
  };
  onAdd: (todo: TodoInput) => void;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onUpdate: (id: string, updates: Partial<Omit<Todo, "id" | "createdAt">>) => void;
  onArchive: (id: string) => void;
  onFocusTodo: (todo: Todo) => void;
  onAddGoal: (input: Partial<Goal> & { title: string }) => void;
  onToggleGoal: (id: string) => void;
  onDeleteGoal: (id: string) => void;
  categories?: Category[];
  goals?: Goal[];
};

export function WeeklyView({
  todos,
  getTodosByDate,
  focusStats,
  onAdd,
  onAddGoal,
  onToggleGoal,
  onDeleteGoal,
  categories = [],
  goals = [],
}: WeeklyViewProps) {
  const [selectedDate, setSelectedDate] = useState(todayKey());
  const [goalTitle, setGoalTitle] = useState("");
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

  const submitGoal = (event: FormEvent) => {
    event.preventDefault();
    if (!goalTitle.trim()) return;
    onAddGoal({
      title: goalTitle.trim(),
      type: "WEEKLY",
      weekStartDate: weekStart,
      weekEndDate: weekEnd,
      dueDate: weekEnd,
      progress: 0,
      completed: false,
    });
    setGoalTitle("");
  };

  return (
    <div className="space-y-5">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {[
          { label: "이번 주", value: `${formatKoreanDate(weekStart, "M.d")} ~ ${formatKoreanDate(weekEnd, "M.d")}` },
          { label: "주간 목표", value: `${weeklyGoals.length}개` },
          { label: "완료 / 미완료", value: `${completedWeeklyGoals} / ${activeWeeklyGoals}` },
          { label: "Todo 완료율", value: `${weekRate}%` },
          { label: "집중 시간", value: `${focusStats?.weekMinutes || 0}분` },
        ].map((item) => (
          <article key={item.label} className="app-card p-3">
            <p className="text-xs font-semibold text-ink-500">{item.label}</p>
            <p className="mt-1 text-lg font-bold text-ink-100">{item.value}</p>
          </article>
        ))}
      </section>

      <section className="app-card p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Target size={18} className="text-accent-400" />
              <h3 className="text-lg font-bold text-ink-100">이번 주 목표</h3>
            </div>
            <p className="mt-1 text-sm text-ink-400">
              {formatKoreanDate(weekStart, "yyyy.MM.dd")} ~ {formatKoreanDate(weekEnd, "yyyy.MM.dd")}
            </p>
            <p className="mt-1 text-xs text-ink-500">
              주간 목표 {weeklyGoals.length}개 · 완료 {completedWeeklyGoals}개 · 미완료 {activeWeeklyGoals}개
            </p>
          </div>
          <form onSubmit={submitGoal} className="flex w-full gap-2 lg:max-w-md">
            <input
              className="field min-h-10 flex-1 py-1.5"
              value={goalTitle}
              onChange={(event) => setGoalTitle(event.target.value)}
              placeholder="이번 주 목표를 입력하세요"
            />
            <button type="submit" className="btn-primary min-h-10 px-3 py-1.5" disabled={!goalTitle.trim()}>
              <Plus size={16} />
              목표 추가
            </button>
          </form>
        </div>

        <div className="mt-4">
          {weeklyGoals.length ? (
            <div className="space-y-2">
              {weeklyGoals.map((goal) => (
                <article key={goal.id} className={`rounded-lg border border-ink-700 bg-ink-950/45 p-3 ${goal.completed ? "opacity-60" : ""}`}>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex min-w-0 items-center gap-2">
                        <button
                          type="button"
                          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                            goal.completed ? "border-success bg-success text-ink-950" : "border-ink-600 text-transparent hover:border-accent-400"
                          }`}
                          onClick={() => onToggleGoal(goal.id)}
                          aria-pressed={goal.completed}
                          aria-label="주간 목표 완료"
                        >
                          <CheckCircle2 size={13} />
                        </button>
                        <h4 className={`truncate font-semibold ${goal.completed ? "text-ink-500 line-through" : "text-ink-100"}`}>{goal.title}</h4>
                        {goal.completed ? (
                          <span className="rounded-full border border-success/35 bg-success/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-100">
                            완료
                          </span>
                        ) : null}
                      </div>
                      {goal.description ? <p className="mt-1 line-clamp-1 text-xs text-ink-500">{goal.description}</p> : null}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <button
                        type="button"
                        className="icon-btn min-h-8 min-w-8 rounded-md hover:border-danger hover:text-red-100"
                        onClick={() => window.confirm("주간 목표를 삭제할까요?") && onDeleteGoal(goal.id)}
                        aria-label="주간 목표 삭제"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-ink-700 bg-ink-950/35 p-5 text-center">
              <p className="font-semibold text-ink-200">이번 주 목표가 없습니다.</p>
              <p className="mt-1 text-sm text-ink-500">이번 주에 집중할 목표를 추가해보세요.</p>
            </div>
          )}
        </div>
      </section>

      <section className="grid gap-2 xl:grid-cols-7">
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
              className={`rounded-lg border p-3 text-left transition hover:border-accent-500/60 ${
                isSelected ? "border-accent-500/70 bg-accent-500/10" : "border-ink-700 bg-ink-800"
              } ${isToday ? "ring-2 ring-accent-500/60" : ""} ${dayTodos.length ? "min-h-36" : "min-h-28"}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <p className="whitespace-nowrap text-sm font-bold text-ink-100">{formatKoreanDate(day, "E요일")}</p>
                    {isToday ? (
                      <span className="whitespace-nowrap rounded-full bg-accent-500 px-2 py-0.5 text-[11px] font-bold text-white">
                        오늘
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-xs text-ink-400">{formatKoreanDate(day, "M월 d일")}</p>
                </div>
                <span
                  className={`inline-flex shrink-0 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
                    activeCount
                      ? "border-warning/45 bg-warning/15 text-amber-100"
                      : "border-success/45 bg-success/15 text-emerald-100"
                  }`}
                >
                  미완료 {activeCount}
                </span>
              </div>

              <div className="mt-3 space-y-1.5">
                {dayTodos.slice(0, 4).map((todo) => (
                  <div key={todo.id} className={`flex min-w-0 items-center gap-2 text-xs ${todo.completed ? "opacity-50" : ""}`}>
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: todo.category?.color || "#64748b" }}
                      aria-hidden="true"
                    />
                    <span className={`min-w-0 flex-1 truncate font-medium text-ink-200 ${todo.completed ? "line-through" : ""}`}>{todo.title}</span>
                    <span className="shrink-0 text-[11px] text-ink-500">{priorityLabel[todo.priority]}</span>
                  </div>
                ))}
                {dayTodos.length === 0 ? <p className="text-sm text-ink-500">계획 없음</p> : null}
                {dayTodos.length > 4 ? <p className="text-xs text-ink-500">+{dayTodos.length - 4}개 더 있음</p> : null}
              </div>
            </button>
          );
        })}
      </section>

      <section className="app-card p-4">
        <div className="mb-3 flex items-center gap-2">
          <Plus size={17} className="text-accent-400" />
          <h3 className="font-semibold text-ink-100">{formatKoreanDate(selectedDate, "M월 d일 EEEE")} 빠른 추가</h3>
        </div>
        <TodoForm onAdd={onAdd} defaultDate={selectedDate} compact categories={categories} submitLabel="추가" />
      </section>
    </div>
  );
}
