import type { Todo, TodoInput } from "../types/todo";
import type { Category } from "../types/category";
import type { Goal } from "../types/goal";
import { WeeklyView } from "../components/calendar/WeeklyView";

type WeekPageProps = {
  weekTodos: Todo[];
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

export function WeekPage({
  weekTodos,
  getTodosByDate,
  onAdd,
  onToggle,
  onDelete,
  onUpdate,
  onAddGoal,
  onUpdateGoal,
  onToggleGoal,
  onDeleteGoal,
  categories = [],
  goals = [],
}: WeekPageProps) {
  return (
    <div className="mx-auto w-full max-w-[1120px] space-y-4">
      <section>
        <h2 className="text-2xl font-bold text-ink-100">주간</h2>
        <p className="mt-1 text-sm text-ink-500">한 주의 작업 분포를 보고, 선택한 날짜의 Todo를 집중해서 관리합니다.</p>
      </section>
      <WeeklyView
        todos={weekTodos}
        getTodosByDate={getTodosByDate}
        onAdd={onAdd}
        onToggle={onToggle}
        onDelete={onDelete}
        onUpdate={onUpdate}
        onAddGoal={onAddGoal}
        onUpdateGoal={onUpdateGoal}
        onToggleGoal={onToggleGoal}
        onDeleteGoal={onDeleteGoal}
        categories={categories}
        goals={goals}
      />
    </div>
  );
}
