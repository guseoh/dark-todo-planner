import { useEffect, useMemo, useState } from "react";
import { FolderPlus } from "lucide-react";
import type { Category } from "../../types/category";
import type { Todo, TodoInput } from "../../types/todo";
import { CategoryForm } from "../category/CategoryForm";
import { EmptyState } from "../common/EmptyState";
import { TodoEditModal } from "./TodoEditModal";
import { CategoryTodoGroup, type TodoGroup } from "./CategoryTodoGroup";

const COLLAPSE_STORAGE_KEY = "dark-todo-planner:collapsed-category-groups";
const uncategorizedGroupId = "uncategorized";
const priorityOrder = { HIGH: 0, MEDIUM: 1, LOW: 2 } as const;

type CollapsedState = Record<string, boolean>;

type GroupedTodoListProps = {
  todos: Todo[];
  categories: Category[];
  onAddTodo: (todo: TodoInput) => void | Promise<void>;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onUpdate: (id: string, updates: Partial<Omit<Todo, "id" | "createdAt">>) => void;
  onArchive?: (id: string) => void;
  onUnarchive?: (id: string) => void;
  onFocusTodo?: (todo: Todo) => void;
  onAddCategory?: (input: { name: string; description?: string; color?: string }) => void | Promise<void>;
  onUpdateCategory?: (id: string, input: Partial<Category>) => void | Promise<void>;
  onDeleteCategory?: (id: string, mode: "moveTodos" | "deleteTodos") => void | Promise<void>;
  emptyTitle: string;
  emptyDescription?: string;
  showDate?: boolean;
  defaultDate?: string;
  includeEmptyCategories?: boolean;
  showCategoryCreator?: boolean;
};

const readCollapsedState = (): CollapsedState => {
  try {
    return JSON.parse(localStorage.getItem(COLLAPSE_STORAGE_KEY) || "{}") as CollapsedState;
  } catch {
    return {};
  }
};

const sortTodos = (todos: Todo[]) =>
  [...todos].sort((a, b) => {
    const orderDiff = (a.order ?? 0) - (b.order ?? 0);
    if (orderDiff) return orderDiff;
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
    if (priorityDiff) return priorityDiff;
    const dateDiff = a.date.localeCompare(b.date);
    if (dateDiff) return dateDiff;
    return b.createdAt.localeCompare(a.createdAt);
  });

const buildGroups = (todos: Todo[], categories: Category[], includeEmptyCategories: boolean): TodoGroup[] => {
  const categoryMap = new Map(categories.map((category) => [category.id, category]));
  const sortedCategories = [...categories].sort((a, b) => {
    const orderDiff = a.order - b.order;
    if (orderDiff) return orderDiff;
    return a.name.localeCompare(b.name, "ko");
  });

  const groups: TodoGroup[] = sortedCategories
    .map((category) => {
      const groupTodos = sortTodos(todos.filter((todo) => todo.categoryId === category.id));
      const completedCount = groupTodos.filter((todo) => todo.completed).length;
      return {
        category,
        todos: groupTodos,
        totalCount: groupTodos.length,
        completedCount,
        completionRate: groupTodos.length ? Math.round((completedCount / groupTodos.length) * 100) : 0,
      };
    })
    .filter((group) => includeEmptyCategories || group.totalCount > 0);

  const uncategorizedTodos = sortTodos(todos.filter((todo) => !todo.categoryId || !categoryMap.has(todo.categoryId)));
  const uncategorizedCompleted = uncategorizedTodos.filter((todo) => todo.completed).length;
  if (uncategorizedTodos.length || includeEmptyCategories) {
    groups.push({
      category: null,
      todos: uncategorizedTodos,
      totalCount: uncategorizedTodos.length,
      completedCount: uncategorizedCompleted,
      completionRate: uncategorizedTodos.length ? Math.round((uncategorizedCompleted / uncategorizedTodos.length) * 100) : 0,
    });
  }
  return groups;
};

export function GroupedTodoList({
  todos,
  categories,
  onAddTodo,
  onToggle,
  onDelete,
  onUpdate,
  onArchive,
  onUnarchive,
  onFocusTodo,
  onAddCategory,
  onUpdateCategory,
  onDeleteCategory,
  emptyTitle,
  emptyDescription,
  showDate = true,
  defaultDate,
  includeEmptyCategories = false,
  showCategoryCreator = true,
}: GroupedTodoListProps) {
  const [collapsedGroups, setCollapsedGroups] = useState<CollapsedState>(() => readCollapsedState());
  const [editingTodo, setEditingTodo] = useState<Todo | null>(null);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [categoryError, setCategoryError] = useState("");
  const groups = useMemo(() => buildGroups(todos, categories, includeEmptyCategories), [todos, categories, includeEmptyCategories]);

  useEffect(() => {
    localStorage.setItem(COLLAPSE_STORAGE_KEY, JSON.stringify(collapsedGroups));
  }, [collapsedGroups]);

  const toggleCollapse = (groupId: string) => {
    setCollapsedGroups((current) => ({ ...current, [groupId]: !current[groupId] }));
  };

  const createCategory = async (input: { name: string; description?: string; color?: string }) => {
    if (!onAddCategory) return;
    try {
      setCategoryError("");
      await onAddCategory(input);
      setCreatingCategory(false);
    } catch (error) {
      setCategoryError(error instanceof Error ? error.message : "카테고리를 저장하지 못했습니다.");
    }
  };

  if (!todos.length && !categories.length) {
    return (
      <div className="space-y-3">
        {showCategoryCreator && onAddCategory ? (
          creatingCategory ? (
            <CategoryForm onSubmit={createCategory} onCancel={() => setCreatingCategory(false)} submitLabel="카테고리 추가" />
          ) : (
            <button type="button" className="btn-secondary" onClick={() => setCreatingCategory(true)}>
              <FolderPlus size={17} />
              카테고리 추가
            </button>
          )
        ) : null}
        {categoryError ? <p className="text-sm text-red-200">{categoryError}</p> : null}
        <EmptyState title={emptyTitle} description={emptyDescription} />
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        {showCategoryCreator && onAddCategory ? (
          creatingCategory ? (
            <CategoryForm onSubmit={createCategory} onCancel={() => setCreatingCategory(false)} submitLabel="카테고리 추가" />
          ) : (
            <button type="button" className="btn-secondary" onClick={() => setCreatingCategory(true)}>
              <FolderPlus size={17} />
              카테고리 추가
            </button>
          )
        ) : null}
        {categoryError ? <p className="text-sm text-red-200">{categoryError}</p> : null}

        {groups.length ? (
          <div className="space-y-2.5">
            {groups.map((group) => {
              const groupId = group.category?.id || uncategorizedGroupId;
              return (
                <CategoryTodoGroup
                  key={groupId}
                  group={group}
                  collapsed={Boolean(collapsedGroups[groupId])}
                  editingCategoryId={editingCategoryId}
                  defaultDate={defaultDate}
                  showDate={showDate}
                  onToggleCollapse={() => toggleCollapse(groupId)}
                  onStartEditCategory={(category) => setEditingCategoryId(category.id)}
                  onCancelEditCategory={() => setEditingCategoryId(null)}
                  onUpdateCategory={onUpdateCategory || (() => undefined)}
                  onDeleteCategory={onDeleteCategory || (() => undefined)}
                  onAddTodo={onAddTodo}
                  onToggle={onToggle}
                  onDelete={onDelete}
                  onArchive={onArchive}
                  onUnarchive={onUnarchive}
                  onFocusTodo={onFocusTodo}
                  onEditTodo={setEditingTodo}
                />
              );
            })}
          </div>
        ) : (
          <EmptyState title={emptyTitle} description={emptyDescription} />
        )}
      </div>

      <TodoEditModal todo={editingTodo} categories={categories} onClose={() => setEditingTodo(null)} onSave={onUpdate} />
    </>
  );
}
