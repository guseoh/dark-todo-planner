import type { Todo, TodoInput } from "../types/todo";
import type { Category } from "../types/category";
import type { Goal } from "../types/goal";
import { MonthlyView } from "../components/calendar/MonthlyView";

type MonthPageProps = {
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
  onToggleGoal: (id: string) => void;
  onDeleteGoal: (id: string) => void;
  onAddCategory: (input: { name: string; description?: string; color?: string }) => void | Promise<void>;
  onUpdateCategory: (id: string, input: Partial<Category>) => void | Promise<void>;
  onDeleteCategory: (id: string, mode: "moveTodos" | "deleteTodos") => void | Promise<void>;
};

export function MonthPage({
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
  onToggleGoal,
  onDeleteGoal,
  onAddCategory,
  onUpdateCategory,
  onDeleteCategory,
}: MonthPageProps) {
  return (
    <div className="space-y-6">
      <section>
        <h2 className="text-2xl font-bold text-ink-100 sm:text-3xl">월간 보기</h2>
        <p className="mt-2 text-sm text-ink-400">달력에서 날짜를 선택하고 해당 날짜의 Todo를 관리합니다.</p>
      </section>
      <MonthlyView
        todos={todos}
        getTodosByDate={getTodosByDate}
        onAdd={onAdd}
        onToggle={onToggle}
        onDelete={onDelete}
        onUpdate={onUpdate}
        onArchive={onArchive}
        categories={categories}
        goals={goals}
        onAddGoal={onAddGoal}
        onToggleGoal={onToggleGoal}
        onDeleteGoal={onDeleteGoal}
        onAddCategory={onAddCategory}
        onUpdateCategory={onUpdateCategory}
        onDeleteCategory={onDeleteCategory}
      />
    </div>
  );
}
