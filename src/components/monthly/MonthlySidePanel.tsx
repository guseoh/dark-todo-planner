import type { Category } from "../../types/category";
import type { Todo, TodoInput } from "../../types/todo";
import { formatKoreanDate } from "../../lib/date";
import { GroupedTodoList } from "../todo/GroupedTodoList";

type MonthlySidePanelProps = {
  selectedDate: string;
  monthEndLabel: string | null;
  selectedTodos: Todo[];
  categories: Category[];
  onAdd: (todo: TodoInput) => void;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onUpdate: (id: string, updates: Partial<Omit<Todo, "id" | "createdAt">>) => void;
  onAddCategory: (input: { name: string; description?: string; color?: string; icon?: string }) => void | Promise<void>;
  onUpdateCategory: (id: string, input: Partial<Category>) => void | Promise<void>;
  onDeleteCategory: (id: string, mode: "moveTodos" | "deleteTodos") => void | Promise<void>;
};

export function MonthlySidePanel({
  selectedDate,
  monthEndLabel,
  selectedTodos,
  categories,
  onAdd,
  onToggle,
  onDelete,
  onUpdate,
  onAddCategory,
  onUpdateCategory,
  onDeleteCategory,
}: MonthlySidePanelProps) {
  return (
    <aside className="scroll-mt-24">
      <section className="app-card flex flex-col p-4 xl:max-h-[calc(100vh-7rem)] xl:overflow-hidden">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold text-ink-100">선택한 날짜 Todo</h3>
            <p className="mt-1 truncate text-xs text-ink-400">
              {formatKoreanDate(selectedDate)}
              {monthEndLabel ? ` · ${monthEndLabel}` : ""}
            </p>
          </div>
          <span className="shrink-0 rounded-full border border-ink-700 bg-ink-950/70 px-2.5 py-0.5 text-xs text-ink-400">
            {selectedTodos.length}개
          </span>
        </div>
        <div className="min-h-0 xl:overflow-y-auto xl:overscroll-contain xl:pr-1 [&_.icon-btn]:!min-h-9 [&_.icon-btn]:!min-w-9">
          <GroupedTodoList
            todos={selectedTodos}
            categories={categories}
            onAddTodo={onAdd}
            onToggle={onToggle}
            onDelete={onDelete}
            onUpdate={onUpdate}
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
        </div>
      </section>
    </aside>
  );
}
