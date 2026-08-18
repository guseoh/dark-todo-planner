import { useEffect, useMemo, useState } from "react";
import { ChevronDown, History, Settings2 } from "lucide-react";
import { IconRenderer } from "../components/common/IconRenderer";
import { ProgressBar } from "../components/common/ProgressBar";
import { TodayCategoryManager } from "../components/today/TodayCategoryManager";
import { OverdueTodoImportModal } from "../components/todo/OverdueTodoImportModal";
import { TodoEditModal } from "../components/todo/TodoEditModal";
import { TodoForm } from "../components/todo/TodoForm";
import { TodoRow } from "../components/todo/TodoRow";
import { formatKoreanDate, todayKey } from "../lib/date";
import { formatCompletionRate, isDueSoon, isOverdueByDeadline } from "../lib/todo";
import type { OverdueTodoImportMode, OverdueTodoImportResult } from "../lib/todoRecovery";
import type { Category } from "../types/category";
import type { Project } from "../types/project";
import type { Todo, TodoInput } from "../types/todo";

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

const categoryButtonClass = "inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-md border px-2.5 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/35";
const activeCategoryButtonClass = "border-accent-500/40 bg-accent-500/[0.08] text-accent-200";
const idleCategoryButtonClass = "border-ink-700/60 bg-ink-900/60 text-ink-400 hover:border-ink-600 hover:bg-ink-800/70 hover:text-ink-100";

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
  const [showCompleted, setShowCompleted] = useState(true);
  const [showCategoryManager, setShowCategoryManager] = useState(false);

  const today = todayKey();
  const oldestOverdueDate = overdueTodos[0]?.date;
  const sortedCategories = useMemo(
    () => [...categories].sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, "ko")),
    [categories],
  );
  const activeProjects = useMemo(() => projects.filter((project) => !project.archived), [projects]);
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
  const uncategorizedCount = useMemo(() => todayTodos.filter((todo) => !todo.categoryId).length, [todayTodos]);

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

  const activeCategoryName = activeCategoryId === "all"
    ? "오늘"
    : activeCategoryId === "uncategorized"
      ? "미분류"
      : categories.find((category) => category.id === activeCategoryId)?.name || "카테고리";
  const inlineCategoryId = activeCategoryId === "all" || activeCategoryId === "uncategorized" ? "" : activeCategoryId;
  const lockInlineCategory = activeCategoryId !== "all";

  useEffect(() => {
    if (activeCategoryId === "all" || activeCategoryId === "uncategorized") return;
    if (!categories.some((category) => category.id === activeCategoryId)) setActiveCategoryId("all");
  }, [activeCategoryId, categories]);

  useEffect(() => {
    setShowCompleted(true);
  }, [activeCategoryId]);

  const renderTodo = (todo: Todo) => (
    <TodoRow
      key={todo.id}
      todo={todo}
      onToggle={(id) => {
        if (!todo.completed) setShowCompleted(true);
        onToggle(id);
      }}
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
        <span className="rounded-full border border-ink-700/55 bg-ink-900/60 px-2.5 py-1 text-[11px] font-semibold text-ink-500" title="Todo Planner의 하루는 오전 3시에 바뀝니다.">
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
        <section className="flex flex-col gap-2 rounded-md border border-warning/20 bg-warning/[0.035] px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-ink-200">지난 일정 {overdueTodos.length}개가 남아 있습니다.</p>
            <p className="mt-0.5 text-[11px] text-ink-500">가장 오래된 일정 {oldestOverdueDate ? formatKoreanDate(oldestOverdueDate, "M월 d일") : "-"}</p>
          </div>
          <button type="button" className="btn-secondary shrink-0 px-2.5 text-xs" onClick={() => setShowOverdueImport(true)}>
            <History size={14} />가져오기
          </button>
        </section>
      ) : null}

      <section className="space-y-3" aria-labelledby="today-todo-list-title">
        <div className="sticky top-[60px] z-20 -mx-1 rounded-lg border border-ink-800/60 bg-ink-950/90 px-1 py-1.5 backdrop-blur-xl">
          <div className="flex items-center gap-2">
            <div className="min-w-0 flex-1 overflow-x-auto pb-0.5">
              <div className="flex w-max gap-1.5 pr-2" aria-label="오늘 Todo 카테고리 필터">
                <button type="button" className={`${categoryButtonClass} ${activeCategoryId === "all" ? activeCategoryButtonClass : idleCategoryButtonClass}`} onClick={() => setActiveCategoryId("all")}>
                  전체 <span className="opacity-75">{todayTodos.length}</span>
                </button>
                {visibleCategories.map((category) => (
                  <button key={category.id} type="button" className={`${categoryButtonClass} ${activeCategoryId === category.id ? activeCategoryButtonClass : idleCategoryButtonClass}`} onClick={() => setActiveCategoryId(category.id)} title={category.description || category.name}>
                    <IconRenderer
                      icon={category.icon}
                      color={category.color || "#0b72d7"}
                      name={category.name}
                      className={category.icon ? "h-5 w-5 border-0 bg-transparent" : "h-2 w-2"}
                      iconClassName="h-3.5 w-3.5"
                      fallback="dot"
                    />
                    {category.name}
                    <span className="opacity-75">{categoryCounts.get(category.id) || 0}</span>
                  </button>
                ))}
                {uncategorizedCount > 0 ? (
                  <button type="button" className={`${categoryButtonClass} ${activeCategoryId === "uncategorized" ? activeCategoryButtonClass : idleCategoryButtonClass}`} onClick={() => setActiveCategoryId("uncategorized")}>
                    미분류 <span className="opacity-75">{uncategorizedCount}</span>
                  </button>
                ) : null}
              </div>
            </div>
            <button type="button" className="icon-btn h-9 w-9 shrink-0" onClick={() => setShowCategoryManager(true)} title="카테고리 관리" aria-label="카테고리 관리">
              <Settings2 size={15} />
            </button>
          </div>
        </div>

        <TodoForm
          onAdd={onAdd}
          defaultDate={today}
          defaultCategoryId={inlineCategoryId}
          lockCategory={lockInlineCategory}
          compact
          submitLabel={lockInlineCategory ? `${activeCategoryName}에 추가` : "추가"}
          categories={categories}
          projects={activeProjects}
          showSyntaxHint={false}
        />

        <div className="flex items-end justify-between gap-3">
          <div>
            <h3 id="today-todo-list-title" className="text-sm font-bold text-ink-100">{activeCategoryName} 할 일</h3>
            <p className="mt-0.5 text-[11px] text-ink-500">미완료 Todo를 먼저 보여주고 완료한 항목은 아래에서 취소선으로 바로 확인합니다.</p>
          </div>
          <span className="shrink-0 text-xs font-semibold text-ink-400">미완료 {activeTodos.length}</span>
        </div>

        {activeTodos.length ? (
          <div className="space-y-1.5">{activeTodos.map(renderTodo)}</div>
        ) : (
          <div className="rounded-md border border-dashed border-ink-700/55 px-4 py-7 text-center">
            <p className="text-sm font-semibold text-ink-400">미완료 Todo가 없습니다.</p>
            <p className="mt-1 text-[11px] text-ink-600">바로 위 입력창에서 Todo를 추가하거나 다른 카테고리를 선택해보세요.</p>
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

      <TodoEditModal todo={editingTodo} categories={categories} projects={activeProjects} onClose={() => setEditingTodo(null)} onSave={onUpdate} />

      <TodayCategoryManager
        open={showCategoryManager}
        categories={sortedCategories}
        categoryCounts={categoryCounts}
        onClose={() => setShowCategoryManager(false)}
        onAddCategory={onAddCategory}
        onUpdateCategory={onUpdateCategory}
        onDeleteCategory={onDeleteCategory}
        onReorderCategories={onReorderCategories}
        onCategoryDeleted={(categoryId) => {
          if (activeCategoryId === categoryId) setActiveCategoryId("all");
        }}
      />

      {showOverdueImport ? <OverdueTodoImportModal todos={overdueTodos} onImport={onBringOverdueTodos} onClose={() => setShowOverdueImport(false)} /> : null}
    </div>
  );
}
