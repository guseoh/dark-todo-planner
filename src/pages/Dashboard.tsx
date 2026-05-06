import { CalendarClock, CheckCheck, ListTodo, NotebookPen, Target, TimerReset, TrendingUp } from "lucide-react";
import { formatKoreanDate, getDdayLabel } from "../lib/date";
import type { Goal } from "../types/goal";
import type { Reflection } from "../types/reflection";
import type { Category } from "../types/category";
import type { Todo, TodoInput } from "../types/todo";
import { EmptyState } from "../components/common/EmptyState";
import { StatCard } from "../components/common/StatCard";
import { ProgressBar } from "../components/common/ProgressBar";
import { TodoForm } from "../components/todo/TodoForm";
import { TodoList } from "../components/todo/TodoList";
import { PriorityBadge } from "../components/todo/PriorityBadge";

type DashboardProps = {
  todos: Todo[];
  todayTodos: Todo[];
  stats: {
    todayTotal: number;
    todayCompleted: number;
    todayActive: number;
    todayRate: number;
    weekRate: number;
    monthTotal: number;
  };
  focusStats: {
    todayMinutes: number;
    todayCompletedSessions: number;
  };
  nearestGoal?: Goal;
  recentReflection?: Reflection;
  onAdd: (todo: TodoInput) => void;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onUpdate: (id: string, updates: Partial<Omit<Todo, "id" | "createdAt">>) => void;
  onArchive: (id: string) => void;
  onFocusTodo: (todo: Todo) => void;
  categories?: Category[];
};

export function Dashboard({
  todos,
  todayTodos,
  stats,
  focusStats,
  nearestGoal,
  recentReflection,
  onAdd,
  onToggle,
  onDelete,
  onUpdate,
  onArchive,
  onFocusTodo,
  categories = [],
}: DashboardProps) {
  const recentCompleted = [...todos]
    .filter((todo) => todo.completed)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 5);
  const categorySummaries = [
    ...categories.map((category) => {
      const categoryTodos = todos.filter((todo) => todo.categoryId === category.id);
      const completed = categoryTodos.filter((todo) => todo.completed).length;
      return {
        id: category.id,
        name: category.name,
        color: category.color || "#6366f1",
        total: categoryTodos.length,
        completed,
        active: categoryTodos.length - completed,
        rate: categoryTodos.length ? Math.round((completed / categoryTodos.length) * 100) : 0,
      };
    }),
    (() => {
      const uncategorized = todos.filter((todo) => !todo.categoryId);
      const completed = uncategorized.filter((todo) => todo.completed).length;
      return {
        id: "uncategorized",
        name: "미분류",
        color: "#64748b",
        total: uncategorized.length,
        completed,
        active: uncategorized.length - completed,
        rate: uncategorized.length ? Math.round((completed / uncategorized.length) * 100) : 0,
      };
    })(),
  ]
    .filter((summary) => summary.total > 0)
    .sort((a, b) => b.active - a.active)
    .slice(0, 4);

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-2">
        <p className="text-sm text-ink-400">{formatKoreanDate(new Date(), "yyyy년 M월 d일 EEEE")}</p>
        <h2 className="text-2xl font-bold text-ink-100 sm:text-3xl">오늘의 계획</h2>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="오늘 완료율"
          value={`${stats.todayRate}%`}
          description={`${stats.todayCompleted}/${stats.todayTotal} 완료`}
          icon={<CheckCheck size={20} />}
          progress={stats.todayRate}
        />
        <StatCard
          title="남은 Todo"
          value={stats.todayActive}
          description="오늘 처리할 항목"
          icon={<ListTodo size={20} />}
        />
        <StatCard
          title="이번 주 완료율"
          value={`${stats.weekRate}%`}
          description="월요일부터 일요일까지"
          icon={<TrendingUp size={20} />}
          progress={stats.weekRate}
        />
        <StatCard
          title="이번 달 Todo"
          value={stats.monthTotal}
          description="이번 달 등록된 전체 항목"
          icon={<CalendarClock size={20} />}
        />
        <StatCard
          title="오늘 집중 시간"
          value={`${focusStats.todayMinutes}분`}
          description={`${focusStats.todayCompletedSessions}회 완료`}
          icon={<TimerReset size={20} />}
        />
        <StatCard
          title="가까운 D-Day"
          value={nearestGoal ? getDdayLabel(nearestGoal.dueDate || nearestGoal.targetDate || todayTodos[0]?.date || new Date().toISOString().slice(0, 10)) : "-"}
          description={nearestGoal?.title || "등록된 목표가 없습니다."}
          icon={<Target size={20} />}
        />
        <StatCard
          title="최근 회고"
          value={recentReflection ? formatKoreanDate(recentReflection.date, "M월 d일") : "-"}
          description={recentReflection ? (recentReflection.sections?.[0]?.content || recentReflection.content || "회고 내용") : "작성된 회고가 없습니다."}
          icon={<NotebookPen size={20} />}
        />
      </section>

      {categorySummaries.length ? (
        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {categorySummaries.map((summary) => (
            <article key={summary.id} className="app-card p-4">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: summary.color }} aria-hidden="true" />
                    <h3 className="truncate font-semibold text-ink-100">{summary.name}</h3>
                  </div>
                  <p className="mt-1 text-xs text-ink-500">미완료 {summary.active}개</p>
                </div>
                <span className="rounded-full border border-ink-700 bg-ink-950/70 px-2 py-1 text-xs text-ink-300">
                  {summary.completed}/{summary.total}
                </span>
              </div>
              <ProgressBar value={summary.rate} label={`${summary.rate}% 완료`} />
            </article>
          ))}
        </section>
      ) : null}

      <TodoForm onAdd={onAdd} compact submitLabel="빠른 추가" categories={categories} />

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-ink-100">오늘 Todo</h3>
            <span className="text-sm text-ink-400">{todayTodos.length}개</span>
          </div>
          <TodoList
            todos={todayTodos}
            onToggle={onToggle}
            onDelete={onDelete}
            onUpdate={onUpdate}
            onArchive={onArchive}
            onFocusTodo={onFocusTodo}
            categories={categories}
            emptyTitle="오늘 할 일이 없습니다."
            emptyDescription="새로운 Todo를 추가해보세요."
            groupByCompletion
            showDate={false}
          />
        </div>

        <aside className="space-y-4">
          <h3 className="text-lg font-bold text-ink-100">최근 완료한 Todo</h3>
          {recentCompleted.length ? (
            <div className="space-y-3">
              {recentCompleted.map((todo) => (
                <article key={todo.id} className="app-card p-4 opacity-75">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-ink-100 line-through">{todo.title}</p>
                      <p className="mt-1 text-xs text-ink-500">{formatKoreanDate(todo.date, "M월 d일 E")}</p>
                    </div>
                    <PriorityBadge priority={todo.priority} />
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState title="아직 완료한 Todo가 없습니다." description="완료 체크를 하면 이곳에 최근 항목이 표시됩니다." />
          )}
        </aside>
      </section>
    </div>
  );
}
