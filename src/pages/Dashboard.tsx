import { CheckCheck, ListTodo, TrendingUp } from "lucide-react";
import { formatKoreanDate } from "../lib/date";
import type { Category } from "../types/category";
import type { Todo, TodoInput } from "../types/todo";
import { EmptyState } from "../components/common/EmptyState";
import { StatCard } from "../components/common/StatCard";
import { ProgressBar } from "../components/common/ProgressBar";
import { TodoForm } from "../components/todo/TodoForm";
import { GroupedTodoList } from "../components/todo/GroupedTodoList";

type DashboardProps = {
  todayTodos: Todo[];
  stats: {
    todayTotal: number;
    todayCompleted: number;
    todayActive: number;
    todayRate: number;
    weekRate: number;
  };
  onAdd: (todo: TodoInput) => void;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onUpdate: (id: string, updates: Partial<Omit<Todo, "id" | "createdAt">>) => void;
  onArchive: (id: string) => void;
  categories?: Category[];
  onAddCategory: (input: { name: string; description?: string; color?: string }) => void | Promise<void>;
  onUpdateCategory: (id: string, input: Partial<Category>) => void | Promise<void>;
  onDeleteCategory: (id: string, mode: "moveTodos" | "deleteTodos") => void | Promise<void>;
};

export function Dashboard({
  todayTodos,
  stats,
  onAdd,
  onToggle,
  onDelete,
  onUpdate,
  onArchive,
  categories = [],
  onAddCategory,
  onUpdateCategory,
  onDeleteCategory,
}: DashboardProps) {
  const categorySummaries = [
    ...categories.map((category) => {
      const categoryTodos = todayTodos.filter((todo) => todo.categoryId === category.id);
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
      const uncategorized = todayTodos.filter((todo) => !todo.categoryId);
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
    <div className="space-y-5">
      <section className="flex flex-col gap-2">
        <p className="text-sm text-ink-400">{formatKoreanDate(new Date(), "yyyy년 M월 d일 EEEE")}</p>
        <h2 className="text-2xl font-bold text-ink-100 sm:text-3xl">오늘의 계획</h2>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
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
          description="이번 주 기준"
          icon={<TrendingUp size={20} />}
          progress={stats.weekRate}
        />
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-base font-bold text-ink-100">카테고리별 오늘 진행 현황</h3>
          <span className="text-xs text-ink-500">{todayTodos.length}개 Todo</span>
        </div>
        {categorySummaries.length ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {categorySummaries.map((summary) => (
              <article key={summary.id} className="app-card p-3">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: summary.color }} aria-hidden="true" />
                      <h3 className="truncate text-sm font-semibold text-ink-100">{summary.name}</h3>
                    </div>
                    <p className="mt-0.5 text-[11px] text-ink-500">미완료 {summary.active}개</p>
                  </div>
                  <span className="rounded-full border border-ink-700 bg-ink-950/70 px-2 py-0.5 text-xs text-ink-300">
                    {summary.completed}/{summary.total}
                  </span>
                </div>
                <ProgressBar value={summary.rate} label={`${summary.rate}%`} />
              </article>
            ))}
          </div>
        ) : (
          <EmptyState title="오늘 등록된 카테고리 Todo가 없습니다." description="빠른 추가나 카테고리 안의 하위 Todo 추가를 사용해보세요." />
        )}
      </section>

      <TodoForm onAdd={onAdd} compact submitLabel="빠른 추가" categories={categories} />

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-ink-100">오늘 Todo</h3>
          <span className="text-sm text-ink-400">{todayTodos.length}개</span>
        </div>
        <GroupedTodoList
          todos={todayTodos}
          categories={categories}
          onAddTodo={onAdd}
          onToggle={onToggle}
          onDelete={onDelete}
          onUpdate={onUpdate}
          onArchive={onArchive}
          onAddCategory={onAddCategory}
          onUpdateCategory={onUpdateCategory}
          onDeleteCategory={onDeleteCategory}
          emptyTitle="오늘 할 일이 없습니다."
          emptyDescription="새로운 Todo를 추가해보세요."
          showDate={false}
          showCategoryCreator={false}
        />
      </section>
    </div>
  );
}
