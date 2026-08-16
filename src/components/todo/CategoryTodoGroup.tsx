import { useState } from "react";
import type { ReactNode } from "react";
import type { Category } from "../../types/category";
import type { Todo, TodoInput } from "../../types/todo";
import { CategoryHeader } from "../category/CategoryHeader";
import { EmptyState } from "../common/EmptyState";
import { InlineTodoAdd } from "./InlineTodoAdd";
import { TodoRow } from "./TodoRow";

export type TodoGroup = {
  category: Category | null;
  todos: Todo[];
  totalCount: number;
  completedCount: number;
  completionRate: number;
};

type CategoryTodoGroupProps = {
  group: TodoGroup;
  duplicateTodoIds?: ReadonlySet<string>;
  collapsed: boolean;
  defaultDate?: string;
  showDate?: boolean;
  onToggleCollapse: () => void;
  onStartEditCategory: (category: Category) => void;
  onDeleteCategory: (id: string, mode: "moveTodos" | "deleteTodos") => void | Promise<void>;
  onAddTodo: (todo: TodoInput) => void | Promise<void>;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onArchive?: (id: string) => void;
  onUnarchive?: (id: string) => void;
  onEditTodo: (todo: Todo) => void;
  variant?: "card" | "plain";
  dragHandle?: ReactNode;
  dragging?: boolean;
  selectionMode?: boolean;
  selectedIds?: ReadonlySet<string>;
  onSelectTodo?: (id: string) => void;
};

export function CategoryTodoGroup({
  group,
  duplicateTodoIds = new Set<string>(),
  collapsed,
  defaultDate,
  showDate = true,
  onToggleCollapse,
  onStartEditCategory,
  onDeleteCategory,
  onAddTodo,
  onToggle,
  onDelete,
  onArchive,
  onUnarchive,
  onEditTodo,
  variant = "card",
  dragHandle,
  dragging = false,
  selectionMode = false,
  selectedIds = new Set<string>(),
  onSelectTodo,
}: CategoryTodoGroupProps) {
  const [adding, setAdding] = useState(false);
  const [showAllTodos, setShowAllTodos] = useState(false);
  const categoryId = group.category?.id;
  const visibleTodos = selectionMode || showAllTodos ? group.todos : group.todos.slice(0, 5);
  const hiddenTodoCount = selectionMode ? 0 : Math.max(group.todos.length - visibleTodos.length, 0);

  const handleDeleteCategory = async () => {
    if (!group.category) return;
    if (!window.confirm(`"${group.category.name}" 카테고리를 삭제할까요?`)) return;
    const deleteTodos = window.confirm("하위 Todo도 함께 삭제할까요?\n\n확인: 카테고리와 Todo 함께 삭제\n취소: Todo는 미분류로 이동");
    await onDeleteCategory(group.category.id, deleteTodos ? "deleteTodos" : "moveTodos");
  };

  return (
    <section className={`${variant === "card" ? "app-card space-y-2 p-3" : "space-y-2"} ${dragging ? "opacity-80 ring-2 ring-accent-400/45" : ""}`}>
      <CategoryHeader
        category={group.category}
        totalCount={group.totalCount}
        completedCount={group.completedCount}
        completionRate={group.completionRate}
        collapsed={collapsed}
        onToggleCollapse={onToggleCollapse}
        onAddTodo={selectionMode ? undefined : () => {
          if (collapsed) onToggleCollapse();
          setAdding(true);
        }}
        onEdit={!selectionMode && group.category ? () => onStartEditCategory(group.category as Category) : undefined}
        onDelete={!selectionMode && group.category ? handleDeleteCategory : undefined}
        dragHandle={selectionMode ? undefined : dragHandle}
      />

      {!collapsed ? (
        <div className={variant === "card" ? "border-l border-ink-700/70 pl-2.5 lg:max-w-4xl" : "pl-1"}>
          <div className="space-y-1">
            {group.todos.length ? (
              visibleTodos.map((todo) => (
                <TodoRow
                  key={todo.id}
                  todo={todo}
                  duplicateCandidate={duplicateTodoIds.has(todo.id)}
                  onToggle={onToggle}
                  onDelete={onDelete}
                  onEdit={onEditTodo}
                  onArchive={onArchive}
                  onUnarchive={onUnarchive}
                  showDate={showDate}
                  showCategoryBadge={false}
                  selectionMode={selectionMode}
                  selected={selectedIds.has(todo.id)}
                  onSelect={onSelectTodo}
                />
              ))
            ) : (
              <EmptyState
                title={group.category ? "이 카테고리에 Todo가 없습니다." : "미분류 Todo가 없습니다."}
                description={group.category ? "첫 번째 Todo를 추가해보세요." : "카테고리를 정하지 않은 Todo가 이곳에 표시됩니다."}
              />
            )}

            {hiddenTodoCount ? (
              <button type="button" className="flex min-h-8 w-full items-center justify-center rounded-md border border-ink-700/70 bg-ink-950/40 px-3 text-xs font-semibold text-ink-400 transition hover:border-accent-500/55 hover:bg-ink-900 hover:text-ink-100" onClick={() => setShowAllTodos(true)}>
                +{hiddenTodoCount}개 더보기
              </button>
            ) : showAllTodos && group.todos.length > 5 && !selectionMode ? (
              <button type="button" className="flex min-h-8 w-full items-center justify-center rounded-md border border-ink-700/70 bg-ink-950/40 px-3 text-xs font-semibold text-ink-400 transition hover:border-accent-500/55 hover:bg-ink-900 hover:text-ink-100" onClick={() => setShowAllTodos(false)}>
                접기
              </button>
            ) : null}

            {!selectionMode ? (
              adding ? (
                <InlineTodoAdd categoryId={categoryId} defaultDate={defaultDate} onAdd={(todo) => onAddTodo(todo)} onCancel={() => setAdding(false)} />
              ) : (
                <button type="button" className="flex min-h-8 w-full items-center rounded-md border border-dashed border-ink-700/70 px-3 text-xs font-semibold text-ink-500 transition hover:border-accent-500/55 hover:bg-ink-900/60 hover:text-ink-100" onClick={() => setAdding(true)}>
                  + Todo 추가
                </button>
              )
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}
