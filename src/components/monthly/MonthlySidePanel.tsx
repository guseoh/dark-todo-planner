import type { Category } from "../../types/category";
import type { Todo, TodoInput } from "../../types/todo";
import { GroupedTodoList } from "../todo/GroupedTodoList";

type MonthlySidePanelProps = {
  selectedDate: string;
  selectedTodos: Todo[];
  categories: Category[];
  onAdd: (todo: TodoInput) => void;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onUpdate: (id: string, updates: Partial<Omit<Todo, "id" | "createdAt">>) => void;
  onArchive: (id: string) => void;
  onAddCategory: (input: { name: string; description?: string; color?: string }) => void | Promise<void>;
  onUpdateCategory: (id: string, input: Partial<Category>) => void | Promise<void>;
  onDeleteCategory: (id: string, mode: "moveTodos" | "deleteTodos") => void | Promise<void>;
};

export function MonthlySidePanel({
  selectedDate,
  selectedTodos,
  categories,
  onAdd,
  onToggle,
  onDelete,
  onUpdate,
  onArchive,
  onAddCategory,
  onUpdateCategory,
  onDeleteCategory,
}: MonthlySidePanelProps) {
  return (
    <aside className="scroll-mt-24 space-y-4">
      <section className="app-card space-y-3 p-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="truncate text-sm font-semibold text-ink-100">선택한 날짜 Todo</h3>
          <span className="shrink-0 rounded-full border border-ink-700 bg-ink-950/70 px-2.5 py-0.5 text-xs text-ink-400">
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
          onAddCategory={onAddCategory}
          onUpdateCategory={onUpdateCategory}
          onDeleteCategory={onDeleteCategory}
          emptyTitle="선택한 날짜의 Todo가 없습니다."
          emptyDescription="오늘 페이지나 카테고리 내부 추가에서 계획을 등록할 수 있습니다."
          showDate={false}
          defaultDate={selectedDate}
          showCategoryCreator={false}
          layout="list"
        />
      </section>
    </aside>
  );
}
