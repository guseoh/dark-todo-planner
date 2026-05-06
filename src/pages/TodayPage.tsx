import { CheckCircle2, CircleDot, ListChecks } from "lucide-react";
import { todayKey } from "../lib/date";
import type { Category } from "../types/category";
import type { Todo, TodoInput } from "../types/todo";
import { StatCard } from "../components/common/StatCard";
import { TodoForm } from "../components/todo/TodoForm";
import { GroupedTodoList } from "../components/todo/GroupedTodoList";

type TodayPageProps = {
  todayTodos: Todo[];
  stats: {
    todayTotal: number;
    todayCompleted: number;
    todayActive: number;
    todayRate: number;
  };
  onAdd: (todo: TodoInput) => void;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onUpdate: (id: string, updates: Partial<Omit<Todo, "id" | "createdAt">>) => void;
  onArchive: (id: string) => void;
  onFocusTodo: (todo: Todo) => void;
  categories?: Category[];
  onAddCategory: (input: { name: string; description?: string; color?: string }) => void | Promise<void>;
  onUpdateCategory: (id: string, input: Partial<Category>) => void | Promise<void>;
  onDeleteCategory: (id: string, mode: "moveTodos" | "deleteTodos") => void | Promise<void>;
};

export function TodayPage({
  todayTodos,
  stats,
  onAdd,
  onToggle,
  onDelete,
  onUpdate,
  onArchive,
  onFocusTodo,
  categories = [],
  onAddCategory,
  onUpdateCategory,
  onDeleteCategory,
}: TodayPageProps) {
  return (
    <div className="space-y-6">
      <section>
        <h2 className="text-2xl font-bold text-ink-100 sm:text-3xl">오늘 보기</h2>
        <p className="mt-2 text-sm text-ink-400">오늘 날짜에 등록된 Todo만 모아봅니다.</p>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="전체" value={stats.todayTotal} icon={<ListChecks size={20} />} />
        <StatCard title="완료" value={stats.todayCompleted} icon={<CheckCircle2 size={20} />} />
        <StatCard title="미완료" value={stats.todayActive} icon={<CircleDot size={20} />} />
        <StatCard title="완료율" value={`${stats.todayRate}%`} progress={stats.todayRate} />
      </section>

      <TodoForm onAdd={onAdd} defaultDate={todayKey()} compact submitLabel="오늘 추가" categories={categories} />

      <GroupedTodoList
        todos={todayTodos}
        categories={categories}
        onAddTodo={onAdd}
        onToggle={onToggle}
        onDelete={onDelete}
        onUpdate={onUpdate}
        onArchive={onArchive}
        onFocusTodo={onFocusTodo}
        onAddCategory={onAddCategory}
        onUpdateCategory={onUpdateCategory}
        onDeleteCategory={onDeleteCategory}
        emptyTitle="오늘 할 일이 없습니다."
        emptyDescription="새로운 Todo를 추가해보세요."
        showDate={false}
        defaultDate={todayKey()}
        showCategoryCreator={false}
      />
    </div>
  );
}
