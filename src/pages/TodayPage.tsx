import { useEffect, useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  History,
  Pencil,
  Plus,
  Settings2,
  Trash2,
} from "lucide-react";
import { formatKoreanDate, todayKey } from "../lib/date";
import { formatCompletionRate, isDueSoon, isOverdueByDeadline } from "../lib/todo";
import type { OverdueTodoImportMode, OverdueTodoImportResult } from "../lib/todoRecovery";
import type { Category } from "../types/category";
import type { Project } from "../types/project";
import type { Todo, TodoInput } from "../types/todo";
import { CategoryForm } from "../components/category/CategoryForm";
import { EmptyState } from "../components/common/EmptyState";
import { Modal } from "../components/common/Modal";
import { ProgressBar } from "../components/common/ProgressBar";
import { OverdueTodoImportModal } from "../components/todo/OverdueTodoImportModal";
import { TodoEditModal } from "../components/todo/TodoEditModal";
import { TodoForm } from "../components/todo/TodoForm";
import { TodoRow } from "../components/todo/TodoRow";

type TodayPageProps = {
  todayTodos: Todo[];
  stats: {
    todayTotal: number;
    todayCompleted: number;
    todayActive: number;
    todayRate: number;
    weekTotal: number;
    weekRate: number;
  };
  onAdd: (todo: TodoInput) => void;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onUpdate: (id: string, updates: Partial<Omit<Todo, "id" | "createdAt">>) => void;
  categories?: Category[];
  projects?: Project[];
  onAddCategory: (input: { name: string; description?: string; color?: string; icon?: string }) => void | Promise<void>;
  onUpdateCategory: (id: string, input: Partial<Category>) => void | Promise<void>;
  onDeleteCategory: (id: string, mode: "moveTodos" | "deleteTodos") => void | Promise<void>;
  onReorderCategories: (ids: string[]) => void | Promise<void>;
  overdueTodos: Todo[];
  onBringOverdueTodos: (
    selectedIds: ReadonlySet<string>,
    mode: OverdueTodoImportMode,
  ) => Promise<OverdueTodoImportResult>;
};

type CategoryFilter = "all" | "uncategorized" | string;

const categoryButtonClass =
  "inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-md px-2.5 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/35";

export function TodayPage({
  todayTodos,
  stats,
  onAdd,
  onToggle,
  onDelete,
  onUpdate,
  categories = [],
  projects = [],
  onAddCategory,
  onUpdateCategory,
  onDeleteCategory,
  onReorderCategories,
  overdueTodos,
  onBringOverdueTodos,
}: TodayPageProps) {
  const [showOverdueImport, setShowOverdueImport] = useState(false);
  const [activeCategoryId, setActiveCategoryId] = useState<CategoryFilter>("all");
  const [editingTodo, setEditingTodo] = useState<Todo | null>(null);
  const [showCompleted, setShowCompleted] = useState(false);
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [categoryError, setCategoryError] = useState("");
  const today = todayKey();
  const oldestOverdueDate = overdueTodos[0]?.date;

  const sortedCategories = useMemo(
    () => [...categories].sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, "ko")),
    [categories],
  );
  const projectById = useMemo(() => new Map(projects.map((project) => [project.id, project])), [projects]);

  const categoryCounts = useMemo(() => {
    const counts = new Map<string, number>();
    todayTodos.forEach((todo) => {
      if (todo.categoryId) counts.set(todo.categoryId, (counts.get(todo.categoryId) || 0) + 1);
    });
    return counts;
  }, [todayTodos]);

  const visibleCategories = useMemo(
    () => sortedCategories.filter((category) => (categoryCounts.get(category.id) || 0) > 0),
    [categoryCounts, sortedCategories],
  );
  const uncategorizedCount = todayTodos.filter((todo) => !todo.categoryId).length;

  const visibleTodos = useMemo(() => {
    if (activeCategoryId === "all") return todayTodos;
    if (activeCategoryId === "uncategorized") return todayTodos.filter((todo) => !todo.categoryId);
    return todayTodos.filter((todo) => todo.categoryId === activeCategoryId);
  }, [activeCategoryId, todayTodos]);

  const activeTodos = useMemo(() => visibleTodos.filter((todo) => !todo.completed), [visibleTodos]);
  const completedTodos = useMemo(() => visibleTodos.filter((todo) => todo.completed), [visibleTodos]);
  const highPriorityCount = useMemo(
    () => todayTodos.filter((todo) => !todo.completed && todo.priority === "HIGH").length,
    [todayTodos],
  );
  const deadlineAttentionCount = useMemo(
    () => todayTodos.filter((todo) => !todo.completed && (isOverdueByDeadline(todo, today) || isDueSoon(todo, today))).length,
    [today, todayTodos],
  );

  useEffect(() => {
    if (activeCategoryId === "all" || activeCategoryId === "uncategorized") return;
    if (!categories.some((category) => category.id === activeCategoryId)) setActiveCategoryId("all");
  }, [activeCategoryId, categories]);

  useEffect(() => {
    setShowCompleted(false);
  }, [activeCategoryId]);

  const moveCategory = async (categoryId: string, direction: -1 | 1) => {
    const ids = sortedCategories.map((category) => category.id);
    const currentIndex = ids.indexOf(categoryId);
    const targetIndex = currentIndex + direction;
    if (currentIndex < 0 || targetIndex < 0 || targetIndex >= ids.length) return;
    [ids[currentIndex], ids[targetIndex]] = [ids[targetIndex], ids[currentIndex]];
    try {
      setCategoryError("");
      await onReorderCategories(ids);
    } catch (error) {
      setCategoryError(error instanceof Error ? error.message : "카테고리 순서를 저장하지 못했습니다.");
    }
  };

  const createCategory = async (input: { name: string; description?: string; color?: string; icon?: string }) => {
    try {
      setCategoryError("");
      await onAddCategory(input);
      setCreatingCategory(false);
    } catch (error) {
      setCategoryError(error instanceof Error ? error.message : "카테고리를 저장하지 못했습니다.");
    }
  };

  const updateCategory = async (input: { name: string; description?: string; color?: string; icon?: string }) => {
    if (!editingCategory) return;
    try {
      setCategoryError("");
      await onUpdateCategory(editingCategory.id, input);
      setEditingCategory(null);
    } catch (error) {
      setCategoryError(error instanceof Error ? error.message : "카테고리를 저장하지 못했습니다.");
    }
  };

  const deleteCategory = async (category: Category) => {
    if (!window.confirm(`"${category.name}" 카테고리를 삭제할까요?`)) return;
    const deleteTodos = window.confirm(
      "하위 Todo도 함께 삭제할까요?\n\n확인: 카테고리와 Todo 함께 삭제\n취소: Todo는 미분류로 이동",
    );
    try {
      setCategoryError("");
      await onDeleteCategory(category.id, deleteTodos ? "deleteTodos" : "moveTodos");
      if (activeCategoryId === category.id) setActiveCategoryId("all");
    } catch (error) {
      setCategoryError(error instanceof Error ? error.message : "카테고리를 삭제하지 못했습니다.");
    }
  };

  const renderTodo = (todo: Todo) => (
    <TodoRow
      key={todo.id}
      todo={todo}
      onToggle={onToggle}
      onDelete={onDelete}
      onEdit={setEditingTodo}
      showDate={false}
      showCategoryBadge={false}
      showCategoryMeta={activeCategoryId === "all"}
      projectName={todo.projectId ? projectById.get(todo.projectId)?.name : undefined}
      hideMediumPriority
    />
  );

  return (
    <div className="mx-auto w-full max-w-[1120px] space-y-4">
      <section className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-ink-100">오늘</h2>
          <p className="mt-1 text-sm text-ink-500">{formatKoreanDate(today, "M월 d일 EEEE")}</p>
        </div>
        <span className="rounded-full border border-ink-700/55 bg-ink-900 px-2.5 py-1 text-[11px] font-semibold text-ink-500" title="Todo Planner의 하루는 오전 3시에 바뀝니다.">
          03:00 기준
        </span>
      </section>

      <section className="app-card px-3.5 py-3" aria-labelledby="today-summary-title">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <h3 id="today-summary-title" className="text-sm font-bold text-ink-100">오늘 진행</h3>
              <p className="text-sm font-semibold text-ink-300">{stats.todayCompleted} / {stats.todayTotal} 완료</p>
              <span className="text-xs font-bold text-accent-300" aria-label={stats.todayTotal ? `오늘 완료율 ${stats.todayRate}%` : "오늘 완료율 계산 대상 없음"}>
                {formatCompletionRate(stats.todayTotal, stats.todayRate)}
              </span>
            </div>
            <p className="mt-1 text-[11px] text-ink-500">해야 할 일과 마감 신호만 빠르게 확인합니다.</p>
          </div>
          <dl className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs">
            <div className="flex items-center gap-1.5"><dt className="text-ink-500">미완료</dt><dd className="font-bold text-ink-100">{stats.todayActive}</dd></div>
            <div className="flex items-center gap-1.5"><dt className="text-ink-500">HIGH</dt><dd className="font-bold text-red-100">{highPriorityCount}</dd></div>
            <div className="flex items-center gap-1.5"><dt className="text-ink-500">마감 주의</dt><dd className="font-bold text-amber-100">{deadlineAttentionCount}</dd></div>
            <div className="flex items-center gap-1.5"><dt className="text-ink-500">이번 주</dt><dd className="font-bold text-ink-300">{formatCompletionRate(stats.weekTotal, stats.weekRate)}</dd></div>
          </dl>
        </div>
        <div className="mt-2.5">
          <ProgressBar value={stats.todayRate} label="오늘 진행률" empty={stats.todayTotal === 0} />
        </div>
      </section>

      {overdueTodos.length > 0 ? (
        <section className="flex flex-col gap-2 rounded-md border border-warning/25 bg-warning/[0.04] px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-ink-200">지난 일정 {overdueTodos.length}개가 남아 있습니다.</p>
            <p className="mt-0.5 text-[11px] text-ink-500">가장 오래된 일정 {oldestOverdueDate ? formatKoreanDate(oldestOverdueDate, "M월 d일") : "-"}</p>
          </div>
          <button type="button" className="btn-secondary shrink-0 px-2.5 text-xs" onClick={() => setShowOverdueImport(true)}>
            <History size={14} />가져오기
          </button>
        </section>
      ) : null}

      <TodoForm onAdd={onAdd} defaultDate={today} compact submitLabel="추가" categories={categories} projects={projects.filter((project) => !project.archived)} showSyntaxHint={false} />

      <section className="space-y-3" aria-labelledby="today-todo-list-title">
        <div className="sticky top-[60px] z-20 -mx-1 rounded-lg bg-ink-950/94 px-1 py-1.5 backdrop-blur-xl">
          <div className="flex items-center gap-2">
            <div className="min-w-0 flex-1 overflow-x-auto pb-0.5">
              <div className="flex w-max gap-1.5 pr-2" aria-label="오늘 Todo 카테고리 필터">
                <button type="button" className={`${categoryButtonClass} ${activeCategoryId === "all" ? "bg-accent-500 text-white" : "bg-ink-900 text-ink-400 hover:bg-ink-800 hover:text-ink-100"}`} onClick={() => setActiveCategoryId("all")}>전체 <span className="opacity-75">{todayTodos.length}</span></button>
                {visibleCategories.map((category) => (
                  <button key={category.id} type="button" className={`${categoryButtonClass} ${activeCategoryId === category.id ? "bg-accent-500 text-white" : "bg-ink-900 text-ink-400 hover:bg-ink-800 hover:text-ink-100"}`} onClick={() => setActiveCategoryId(category.id)} title={category.description || category.name}>
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: category.color || "#6366f1" }} />{category.name}<span className="opacity-75">{categoryCounts.get(category.id) || 0}</span>
                  </button>
                ))}
                {uncategorizedCount > 0 ? <button type="button" className={`${categoryButtonClass} ${activeCategoryId === "uncategorized" ? "bg-accent-500 text-white" : "bg-ink-900 text-ink-400 hover:bg-ink-800 hover:text-ink-100"}`} onClick={() => setActiveCategoryId("uncategorized")}>미분류 <span className="opacity-75">{uncategorizedCount}</span></button> : null}
              </div>
            </div>
            <button type="button" className="icon-btn h-9 w-9 shrink-0" onClick={() => { setCategoryError(""); setShowCategoryManager(true); }} title="카테고리 관리" aria-label="카테고리 관리">
              <Settings2 size={15} />
            </button>
          </div>
        </div>

        <div className="flex items-end justify-between gap-3">
          <div>
            <h3 id="today-todo-list-title" className="text-sm font-bold text-ink-100">
              {activeCategoryId === "all" ? "오늘 할 일" : activeCategoryId === "uncategorized" ? "미분류 할 일" : `${categories.find((category) => category.id === activeCategoryId)?.name || "카테고리"} 할 일`}
            </h3>
            <p className="mt-0.5 text-[11px] text-ink-500">미완료 Todo를 먼저 보여주고 완료한 항목은 아래에 접어둡니다.</p>
          </div>
          <span className="shrink-0 text-xs font-semibold text-ink-400">미완료 {activeTodos.length}</span>
        </div>

        {activeTodos.length ? <div className="space-y-1.5">{activeTodos.map(renderTodo)}</div> : (
          <div className="rounded-md border border-dashed border-ink-700/55 px-4 py-7 text-center">
            <p className="text-sm font-semibold text-ink-400">미완료 Todo가 없습니다.</p>
            <p className="mt-1 text-[11px] text-ink-600">새 Todo를 추가하거나 다른 카테고리를 선택해보세요.</p>
          </div>
        )}

        {completedTodos.length ? (
          <div className="border-t border-ink-800 pt-2">
            <button type="button" className="flex min-h-9 w-full items-center justify-between rounded-md px-2 text-sm font-semibold text-ink-500 transition hover:bg-ink-900/70 hover:text-ink-200" onClick={() => setShowCompleted((value) => !value)} aria-expanded={showCompleted}>
              <span>완료 {completedTodos.length}개</span>
              <ChevronDown size={15} className={`transition ${showCompleted ? "rotate-180" : ""}`} />
            </button>
            {showCompleted ? <div className="mt-1.5 space-y-1.5">{completedTodos.map(renderTodo)}</div> : null}
          </div>
        ) : null}
      </section>

      <TodoEditModal todo={editingTodo} categories={categories} projects={projects.filter((project) => !project.archived)} onClose={() => setEditingTodo(null)} onSave={onUpdate} />

      {showCategoryManager ? (
        <Modal title="카테고리 관리" description="오늘 화면에서는 비어 있는 카테고리를 숨기고, 추가·수정·삭제·순서 변경은 이곳에서 관리합니다." onClose={() => setShowCategoryManager(false)} size="lg">
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-ink-400">전체 {sortedCategories.length}개 카테고리</p>
              <button type="button" className="btn-primary" onClick={() => setCreatingCategory(true)}><Plus size={16} />카테고리 추가</button>
            </div>
            {categoryError ? <p className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-red-100" role="alert">{categoryError}</p> : null}
            {sortedCategories.length ? (
              <div className="space-y-2">
                {sortedCategories.map((category, index) => (
                  <div key={category.id} className="flex items-center gap-3 rounded-lg bg-ink-950/45 px-3 py-2.5">
                    <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: category.color || "#6366f1" }} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-ink-100">{category.name}</p>
                      <p className="mt-0.5 truncate text-xs text-ink-400">오늘 {categoryCounts.get(category.id) || 0}개{category.description ? ` · ${category.description}` : ""}</p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <button type="button" className="icon-btn h-9 w-9 rounded-md" onClick={() => void moveCategory(category.id, -1)} disabled={index === 0} aria-label={`${category.name} 위로 이동`} title="위로 이동"><ChevronUp size={14} /></button>
                      <button type="button" className="icon-btn h-9 w-9 rounded-md" onClick={() => void moveCategory(category.id, 1)} disabled={index === sortedCategories.length - 1} aria-label={`${category.name} 아래로 이동`} title="아래로 이동"><ChevronDown size={14} /></button>
                      <button type="button" className="icon-btn h-9 w-9 rounded-md" onClick={() => setEditingCategory(category)} aria-label={`${category.name} 수정`} title="수정"><Pencil size={14} /></button>
                      <button type="button" className="icon-btn h-9 w-9 rounded-md hover:border-danger hover:text-red-100" onClick={() => void deleteCategory(category)} aria-label={`${category.name} 삭제`} title="삭제"><Trash2 size={14} /></button>
                    </div>
                  </div>
                ))}
              </div>
            ) : <EmptyState title="카테고리가 없습니다." description="필요할 때만 카테고리를 추가해 Todo를 묶어보세요." />}
          </div>
        </Modal>
      ) : null}

      {creatingCategory ? <Modal title="새 카테고리 추가" description="Todo를 묶을 카테고리 이름, 색상, 아이콘을 설정합니다." onClose={() => setCreatingCategory(false)}><CategoryForm onSubmit={createCategory} onCancel={() => setCreatingCategory(false)} submitLabel="카테고리 추가" /></Modal> : null}
      {editingCategory ? <Modal title="카테고리 수정" description="이름, 설명, 색상과 아이콘을 수정합니다." onClose={() => setEditingCategory(null)}><CategoryForm category={editingCategory} onSubmit={updateCategory} onCancel={() => setEditingCategory(null)} submitLabel="변경 저장" /></Modal> : null}
      {showOverdueImport ? <OverdueTodoImportModal todos={overdueTodos} onImport={onBringOverdueTodos} onClose={() => setShowOverdueImport(false)} /> : null}
    </div>
  );
}
