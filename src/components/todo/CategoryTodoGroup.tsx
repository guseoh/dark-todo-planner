import { useState } from "react";
import type { Category } from "../../types/category";
import type { Todo, TodoInput } from "../../types/todo";
import { CategoryForm } from "../category/CategoryForm";
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
  collapsed: boolean;
  editingCategoryId: string | null;
  defaultDate?: string;
  showDate?: boolean;
  onToggleCollapse: () => void;
  onStartEditCategory: (category: Category) => void;
  onCancelEditCategory: () => void;
  onUpdateCategory: (id: string, input: Partial<Category>) => void | Promise<void>;
  onDeleteCategory: (id: string, mode: "moveTodos" | "deleteTodos") => void | Promise<void>;
  onAddTodo: (todo: TodoInput) => void | Promise<void>;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onArchive?: (id: string) => void;
  onUnarchive?: (id: string) => void;
  onEditTodo: (todo: Todo) => void;
  variant?: "card" | "plain";
};

export function CategoryTodoGroup({
  group,
  collapsed,
  editingCategoryId,
  defaultDate,
  showDate = true,
  onToggleCollapse,
  onStartEditCategory,
  onCancelEditCategory,
  onUpdateCategory,
  onDeleteCategory,
  onAddTodo,
  onToggle,
  onDelete,
  onArchive,
  onUnarchive,
  onEditTodo,
  variant = "card",
}: CategoryTodoGroupProps) {
  const [adding, setAdding] = useState(false);
  const [showAllTodos, setShowAllTodos] = useState(false);
  const categoryId = group.category?.id;
  const isEditing = Boolean(categoryId && editingCategoryId === categoryId);
  const visibleTodos = showAllTodos ? group.todos : group.todos.slice(0, 5);
  const hiddenTodoCount = Math.max(group.todos.length - visibleTodos.length, 0);

  const handleDeleteCategory = async () => {
    if (!group.category) return;
    if (!window.confirm(`"${group.category.name}" 카테고리를 삭제할까요?`)) return;
    const deleteTodos = window.confirm("하위 Todo도 함께 삭제할까요?\n\n확인: 카테고리와 Todo 함께 삭제\n취소: Todo는 미분류로 이동");
    await onDeleteCategory(group.category.id, deleteTodos ? "deleteTodos" : "moveTodos");
  };

  return (
    <section className={variant === "card" ? "app-card space-y-2 p-3" : "space-y-2"}>
      <CategoryHeader
        category={group.category}
        totalCount={group.totalCount}
        completedCount={group.completedCount}
        completionRate={group.completionRate}
        collapsed={collapsed}
        onToggleCollapse={onToggleCollapse}
        onAddTodo={() => {
          if (collapsed) onToggleCollapse();
          setAdding(true);
        }}
        onEdit={group.category ? () => onStartEditCategory(group.category as Category) : undefined}
        onDelete={group.category ? handleDeleteCategory : undefined}
      />

      {isEditing && group.category ? (
        <CategoryForm
          category={group.category}
          submitLabel="카테고리 저장"
          onCancel={onCancelEditCategory}
          onSubmit={async (input) => {
            await onUpdateCategory(group.category!.id, input);
            onCancelEditCategory();
          }}
        />
      ) : null}

      {!collapsed ? (
        <div className="border-l border-ink-700/80 pl-2.5">
          <div className="space-y-1.5">
            {group.todos.length ? (
              visibleTodos.map((todo) => (
                <TodoRow
                  key={todo.id}
                  todo={todo}
                  onToggle={onToggle}
                  onDelete={onDelete}
                  onEdit={onEditTodo}
                  onArchive={onArchive}
                  onUnarchive={onUnarchive}
                  showDate={showDate}
                  showCategoryBadge={false}
                />
              ))
            ) : (
              <EmptyState
                title={group.category ? "이 카테고리에 Todo가 없습니다." : "미분류 Todo가 없습니다."}
                description={group.category ? "첫 번째 하위 Todo를 추가해보세요." : "카테고리를 정하지 않은 Todo가 이곳에 표시됩니다."}
              />
            )}

            {hiddenTodoCount ? (
              <button
                type="button"
                className="flex min-h-8 w-full items-center justify-center rounded-lg border border-ink-700 bg-ink-950/45 px-3 text-xs font-semibold text-ink-400 transition hover:border-accent-500/60 hover:bg-ink-900 hover:text-ink-100"
                onClick={() => setShowAllTodos(true)}
              >
                +{hiddenTodoCount}개 더보기
              </button>
            ) : showAllTodos && group.todos.length > 5 ? (
              <button
                type="button"
                className="flex min-h-8 w-full items-center justify-center rounded-lg border border-ink-700 bg-ink-950/45 px-3 text-xs font-semibold text-ink-400 transition hover:border-accent-500/60 hover:bg-ink-900 hover:text-ink-100"
                onClick={() => setShowAllTodos(false)}
              >
                접기
              </button>
            ) : null}

            {adding ? (
              <InlineTodoAdd
                categoryId={categoryId}
                defaultDate={defaultDate}
                onAdd={(todo) => onAddTodo(todo)}
                onCancel={() => setAdding(false)}
              />
            ) : (
              <button
                type="button"
                className="flex min-h-9 w-full items-center rounded-lg border border-dashed border-ink-700 px-3 text-sm font-semibold text-ink-400 transition hover:border-accent-500/60 hover:bg-ink-900/60 hover:text-ink-100"
                onClick={() => setAdding(true)}
              >
                + 하위 Todo 추가
              </button>
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
}
