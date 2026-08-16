import { useEffect, useMemo, useState } from "react";
import {
  closestCenter,
  DndContext,
  DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  rectSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { restrictToParentElement, restrictToWindowEdges } from "@dnd-kit/modifiers";
import { CSS } from "@dnd-kit/utilities";
import { FolderPlus, GripVertical } from "lucide-react";
import type { Category } from "../../types/category";
import type { Todo, TodoInput } from "../../types/todo";
import { CategoryForm } from "../category/CategoryForm";
import { Modal } from "../common/Modal";
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
  duplicateTodoIds?: ReadonlySet<string>;
  onAddTodo: (todo: TodoInput) => void | Promise<void>;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onUpdate: (id: string, updates: Partial<Omit<Todo, "id" | "createdAt">>) => void;
  onArchive?: (id: string) => void;
  onUnarchive?: (id: string) => void;
  onAddCategory?: (input: { name: string; description?: string; color?: string; icon?: string }) => void | Promise<void>;
  onUpdateCategory?: (id: string, input: Partial<Category>) => void | Promise<void>;
  onDeleteCategory?: (id: string, mode: "moveTodos" | "deleteTodos") => void | Promise<void>;
  onReorderCategories?: (ids: string[]) => void | Promise<void>;
  emptyTitle: string;
  emptyDescription?: string;
  showDate?: boolean;
  defaultDate?: string;
  includeEmptyCategories?: boolean;
  showCategoryCreator?: boolean;
  layout?: "board" | "list";
  sortableCategories?: boolean;
  selectionMode?: boolean;
  selectedIds?: ReadonlySet<string>;
  onSelectTodo?: (id: string) => void;
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

type SortableCategoryTodoGroupProps = {
  group: TodoGroup;
  expanded: boolean;
  children: (options: { dragHandle: JSX.Element; dragging: boolean }) => JSX.Element;
};

function SortableCategoryTodoGroup({ group, expanded, children }: SortableCategoryTodoGroupProps) {
  const id = group.category?.id || uncategorizedGroupId;
  const { attributes, listeners, setActivatorNodeRef, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 20 : undefined,
  };
  const name = group.category?.name || "미분류";

  return (
    <div ref={setNodeRef} style={style} className={`min-w-0 ${expanded ? "col-span-full" : ""} ${isDragging ? "relative" : ""}`}>
      {children({
        dragging: isDragging,
        dragHandle: (
          <button type="button" ref={setActivatorNodeRef} className="hidden h-8 w-8 shrink-0 cursor-grab items-center justify-center rounded-md border border-ink-700 bg-ink-950/70 text-ink-500 transition hover:border-accent-500/60 hover:text-ink-100 active:cursor-grabbing sm:inline-flex" aria-label={`${name} 카테고리 순서 변경`} title="드래그해서 카테고리 순서 변경" {...attributes} {...listeners}>
            <GripVertical size={14} />
          </button>
        ),
      })}
    </div>
  );
}

export function GroupedTodoList({
  todos,
  categories,
  duplicateTodoIds = new Set<string>(),
  onAddTodo,
  onToggle,
  onDelete,
  onUpdate,
  onArchive,
  onUnarchive,
  onAddCategory,
  onUpdateCategory,
  onDeleteCategory,
  onReorderCategories,
  emptyTitle,
  emptyDescription,
  showDate = true,
  defaultDate,
  includeEmptyCategories = false,
  showCategoryCreator = true,
  layout = "board",
  sortableCategories = false,
  selectionMode = false,
  selectedIds = new Set<string>(),
  onSelectTodo,
}: GroupedTodoListProps) {
  const [collapsedGroups, setCollapsedGroups] = useState<CollapsedState>(() => readCollapsedState());
  const [editingTodo, setEditingTodo] = useState<Todo | null>(null);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [categoryError, setCategoryError] = useState("");
  const groups = useMemo(() => buildGroups(todos, categories, includeEmptyCategories), [todos, categories, includeEmptyCategories]);
  const editingCategory = useMemo(() => (editingCategoryId ? categories.find((category) => category.id === editingCategoryId) || null : null), [categories, editingCategoryId]);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const categoryGroups = groups.filter((group) => group.category);
  const uncategorizedGroups = groups.filter((group) => !group.category);
  const sortableIds = categoryGroups.map((group) => group.category!.id);

  useEffect(() => { localStorage.setItem(COLLAPSE_STORAGE_KEY, JSON.stringify(collapsedGroups)); }, [collapsedGroups]);

  const toggleCollapse = (groupId: string) => {
    if (selectionMode) return;
    setCollapsedGroups((current) => ({ ...current, [groupId]: !current[groupId] }));
  };

  const createCategory = async (input: { name: string; description?: string; color?: string; icon?: string }) => {
    if (!onAddCategory) return;
    try {
      setCategoryError("");
      await onAddCategory(input);
      setCreatingCategory(false);
    } catch (error) {
      setCategoryError(error instanceof Error ? error.message : "카테고리를 저장하지 못했습니다.");
    }
  };

  const updateCategory = async (input: { name: string; description?: string; color?: string; icon?: string }) => {
    if (!onUpdateCategory || !editingCategory) return;
    try {
      setCategoryError("");
      await onUpdateCategory(editingCategory.id, input);
      setEditingCategoryId(null);
    } catch (error) {
      setCategoryError(error instanceof Error ? error.message : "카테고리를 저장하지 못했습니다.");
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !onReorderCategories) return;
    const oldIndex = sortableIds.indexOf(String(active.id));
    const newIndex = sortableIds.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    const nextIds = arrayMove(sortableIds, oldIndex, newIndex);
    try {
      setCategoryError("");
      await onReorderCategories(nextIds);
    } catch (error) {
      setCategoryError(error instanceof Error ? error.message : "카테고리 순서를 저장하지 못했습니다.");
    }
  };

  const startEditCategory = (category: Category) => {
    setCategoryError("");
    setEditingCategoryId(category.id);
  };

  const groupProps = {
    duplicateTodoIds,
    defaultDate,
    showDate,
    onStartEditCategory: startEditCategory,
    onDeleteCategory: onDeleteCategory || (() => undefined),
    onAddTodo,
    onToggle,
    onDelete,
    onArchive,
    onUnarchive,
    onEditTodo: setEditingTodo,
    selectionMode,
    selectedIds,
    onSelectTodo,
  };

  if (!todos.length && !categories.length) {
    return (
      <div className="space-y-3">
        {showCategoryCreator && onAddCategory ? <button type="button" className="btn-secondary" onClick={() => { setCategoryError(""); setCreatingCategory(true); }}><FolderPlus size={16} />카테고리 추가</button> : null}
        {categoryError ? <p className="text-sm text-red-200">{categoryError}</p> : null}
        <EmptyState title={emptyTitle} description={emptyDescription} />
        {creatingCategory ? <Modal title="새 카테고리 추가" description="Todo를 묶을 카테고리 이름, 색상, 아이콘을 설정합니다." onClose={() => setCreatingCategory(false)}>{categoryError ? <p className="mb-3 rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-red-100">{categoryError}</p> : null}<CategoryForm onSubmit={createCategory} onCancel={() => setCreatingCategory(false)} submitLabel="카테고리 추가" /></Modal> : null}
      </div>
    );
  }

  const renderGroup = (group: TodoGroup, dragHandle?: JSX.Element, dragging = false) => {
    const groupId = group.category?.id || uncategorizedGroupId;
    const collapsed = selectionMode ? false : Boolean(collapsedGroups[groupId]);
    return <CategoryTodoGroup {...groupProps} group={group} collapsed={collapsed} onToggleCollapse={() => toggleCollapse(groupId)} variant={layout === "board" ? "card" : "plain"} dragHandle={dragHandle} dragging={dragging} />;
  };

  return (
    <>
      <div className="space-y-3">
        {showCategoryCreator && onAddCategory && !selectionMode ? <button type="button" className="btn-secondary" onClick={() => { setCategoryError(""); setCreatingCategory(true); }}><FolderPlus size={16} />카테고리 추가</button> : null}
        {categoryError ? <p className="text-sm text-red-200">{categoryError}</p> : null}

        {groups.length ? (
          <div className={layout === "board" ? "grid min-w-0 grid-cols-1 items-start gap-3 overflow-x-clip md:grid-cols-2 xl:grid-cols-3" : "min-w-0 space-y-2 overflow-x-clip"}>
            {sortableCategories && onReorderCategories && !selectionMode ? (
              <DndContext sensors={sensors} collisionDetection={closestCenter} modifiers={[restrictToParentElement, restrictToWindowEdges]} onDragEnd={handleDragEnd}>
                <SortableContext items={sortableIds} strategy={rectSortingStrategy}>
                  {categoryGroups.map((group) => {
                    const groupId = group.category!.id;
                    return (
                      <SortableCategoryTodoGroup key={groupId} group={group} expanded={layout === "board" && !collapsedGroups[groupId]}>
                        {({ dragHandle, dragging }) => renderGroup(group, dragHandle, dragging)}
                      </SortableCategoryTodoGroup>
                    );
                  })}
                </SortableContext>
              </DndContext>
            ) : categoryGroups.map((group) => {
              const groupId = group.category!.id;
              return <div key={groupId} className={layout === "board" && (selectionMode || !collapsedGroups[groupId]) ? "col-span-full" : "min-w-0"}>{renderGroup(group)}</div>;
            })}

            {uncategorizedGroups.map((group) => {
              const groupId = uncategorizedGroupId;
              return <div key={groupId} className={layout === "board" && (selectionMode || !collapsedGroups[groupId]) ? "col-span-full" : "min-w-0"}>{renderGroup(group)}</div>;
            })}
          </div>
        ) : <EmptyState title={emptyTitle} description={emptyDescription} />}
      </div>

      {creatingCategory ? <Modal title="새 카테고리 추가" description="Todo를 묶을 카테고리 이름, 색상, 아이콘을 설정합니다." onClose={() => setCreatingCategory(false)}>{categoryError ? <p className="mb-3 rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-red-100">{categoryError}</p> : null}<CategoryForm onSubmit={createCategory} onCancel={() => setCreatingCategory(false)} submitLabel="카테고리 추가" /></Modal> : null}

      {editingCategory ? <Modal title="카테고리 수정" description="카테고리 카드에 표시할 이름, 설명, 색상, 아이콘을 정리합니다." onClose={() => setEditingCategoryId(null)}>{categoryError ? <p className="mb-3 rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-red-100">{categoryError}</p> : null}<CategoryForm category={editingCategory} onSubmit={updateCategory} onCancel={() => setEditingCategoryId(null)} submitLabel="저장" /></Modal> : null}

      <TodoEditModal todo={editingTodo} categories={categories} onClose={() => setEditingTodo(null)} onSave={onUpdate} />
    </>
  );
}
