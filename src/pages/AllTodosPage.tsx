import { useMemo, useState } from "react";
import { defaultFilters } from "../hooks/usePlannerData";
import type { Category } from "../types/category";
import type { Todo, TodoFilters, TodoInput } from "../types/todo";
import { TodoFilter } from "../components/todo/TodoFilter";
import { GroupedTodoList } from "../components/todo/GroupedTodoList";

type AllTodosPageProps = {
  filterTodos: (filters: TodoFilters) => Todo[];
  tagOptions: string[];
  categories?: Category[];
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onUpdate: (id: string, updates: Partial<Omit<Todo, "id" | "createdAt">>) => void;
  onArchive: (id: string) => void;
  onFocusTodo: (todo: Todo) => void;
  onAddTodo: (todo: TodoInput) => void;
  onAddCategory: (input: { name: string; description?: string; color?: string }) => void | Promise<void>;
  onUpdateCategory: (id: string, input: Partial<Category>) => void | Promise<void>;
  onDeleteCategory: (id: string, mode: "moveTodos" | "deleteTodos") => void | Promise<void>;
};

export function AllTodosPage({
  filterTodos,
  tagOptions,
  categories = [],
  onToggle,
  onDelete,
  onUpdate,
  onArchive,
  onFocusTodo,
  onAddTodo,
  onAddCategory,
  onUpdateCategory,
  onDeleteCategory,
}: AllTodosPageProps) {
  const [filters, setFilters] = useState<TodoFilters>(defaultFilters);
  const filteredTodos = useMemo(() => filterTodos(filters), [filterTodos, filters]);

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-ink-100 sm:text-3xl">전체 Todo</h2>
          <p className="mt-2 text-sm text-ink-400">검색, 필터, 정렬로 모든 Todo를 빠르게 찾습니다.</p>
        </div>
        <span className="rounded-full border border-ink-700 bg-ink-800 px-3 py-1 text-sm text-ink-300">
          {filteredTodos.length}개 표시
        </span>
      </section>

      <TodoFilter filters={filters} onChange={setFilters} tagOptions={tagOptions} categories={categories} />
      <GroupedTodoList
        todos={filteredTodos}
        categories={categories}
        onAddTodo={onAddTodo}
        onToggle={onToggle}
        onDelete={onDelete}
        onUpdate={onUpdate}
        onArchive={onArchive}
        onFocusTodo={onFocusTodo}
        onAddCategory={onAddCategory}
        onUpdateCategory={onUpdateCategory}
        onDeleteCategory={onDeleteCategory}
        emptyTitle="아직 등록된 Todo가 없습니다."
        emptyDescription="검색 조건을 바꾸거나 새로운 Todo를 추가해보세요."
        includeEmptyCategories
      />
    </div>
  );
}
