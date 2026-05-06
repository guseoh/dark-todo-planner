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
  onArchive: (id: string) => void;
  onFocusTodo: (todo: Todo) => void;
  categories?: Category[];
  goals?: Goal[];
};

export function WeekPage({ weekTodos, getTodosByDate, onAdd, onToggle, onDelete, onUpdate, onArchive, onFocusTodo, categories = [], goals = [] }: WeekPageProps) {
  return (
    <div className="space-y-6">
      <section>
        <h2 className="text-2xl font-bold text-ink-100 sm:text-3xl">주간 보기</h2>
        <p className="mt-2 text-sm text-ink-400">월요일부터 일요일까지 한 주의 계획을 확인합니다.</p>
      </section>
      <WeeklyView
        todos={weekTodos}
        getTodosByDate={getTodosByDate}
        onAdd={onAdd}
        onToggle={onToggle}
        onDelete={onDelete}
        onUpdate={onUpdate}
        onArchive={onArchive}
        onFocusTodo={onFocusTodo}
        categories={categories}
        goals={goals}
      />
    </div>
  );
}
