import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ChevronDown, History, MoonStar, Settings2, Star, StarOff } from "lucide-react";
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
  upcomingTodos?: Todo[];
  onOpenDayClose?: () => void;
  stats: {
    todayTotal: number;
    todayCompleted: number;
    todayActive: number;
    todayRate: number;
    weekTotal: number;
    weekRate: number;
  };
  onAdd: (todo: TodoInput) => Promise<Todo | undefined> | Todo | undefined;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onDeleteMany: (ids: string[]) => Promise<boolean> | boolean;
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

const categoryButtonClass = "inline-flex min-h-10 shrink-0 items-center gap-2 border-b-2 px-3 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ui-focus";
const activeCategoryButtonClass = "border-ui-text text-ui-text font-semibold";
const idleCategoryButtonClass = "border-transparent text-ui-muted hover:border-ui-divider hover:text-ui-text";
const FOCUS_STORAGE_PREFIX = "dark-todo-planner:focus:";
const readFocusIds = (date: string): string[] => {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(FOCUS_STORAGE_PREFIX + date) || "[]");
    return Array.isArray(value) ? Array.from(new Set(value.filter((id): id is string => typeof id === "string"))).slice(0, 3) : [];
  } catch {
    return [];
  }
};

export function TodayPage({
  todayTodos,
  upcomingTodos = [],
  onOpenDayClose,
  stats,
  onAdd,
  onToggle,
  onDelete,
  onDeleteMany,
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
  const [focusIds, setFocusIds] = useState<string[]>(() => readFocusIds(todayKey()));
  const [showCategoryManager, setShowCategoryManager] = useState(false);

  const today = todayKey();
  const focusedTodos = useMemo(() => focusIds.map((id) => todayTodos.find((todo) => todo.id === id)).filter((todo): todo is Todo => Boolean(todo && !todo.completed && !todo.archived)), [focusIds, todayTodos]);
  const focusSet = useMemo(() => new Set(focusedTodos.map((todo) => todo.id)), [focusedTodos]);
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
  const remainingTodos = useMemo(() => activeTodos.filter((todo) => !focusSet.has(todo.id)), [activeTodos, focusSet]);
  const hasTodayTodos = todayTodos.length > 0;
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
    if (!hasTodayTodos && activeCategoryId !== "all") {
      setActiveCategoryId("all");
      return;
    }
    if (activeCategoryId === "all" || activeCategoryId === "uncategorized") return;
    if (!categories.some((category) => category.id === activeCategoryId)) setActiveCategoryId("all");
  }, [activeCategoryId, categories, hasTodayTodos]);

  useEffect(() => {
    setShowCompleted(false);
  }, [activeCategoryId]);

  useEffect(() => {
    setFocusIds(readFocusIds(today));
  }, [today]);

  const toggleFocus = (id: string) => {
    setFocusIds((current) => {
      const valid = current.filter((candidate) => todayTodos.some((todo) => todo.id === candidate && !todo.completed && !todo.archived));
      const next = valid.includes(id) ? valid.filter((candidate) => candidate !== id) : valid.length < 3 ? [...valid, id] : valid;
      try { localStorage.setItem(FOCUS_STORAGE_PREFIX + today, JSON.stringify(next)); } catch { /* storage might be blocked */ }
      return next;
    });
  };

  const renderTodo = (todo: Todo, leadingAction?: ReactNode) => (
    <TodoRow
      key={todo.id}
      todo={todo}
      leadingAction={leadingAction}
      variant="today"
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
    <div className="page-shell today-page">
      <header className="today-header">
        <div className="today-header__identity">
          <h1>오늘</h1>
          <span>{formatKoreanDate(today, "M월 d일 EEEE")}</span>
        </div>
        <div className="today-header__status" role="group" aria-label="오늘 작업 현황">
          <span>남은 작업 <strong>{stats.todayActive}개</strong></span>
          {hasTodayTodos ? (
            <>
              <span>완료 {stats.todayCompleted}/{stats.todayTotal}</span>
              <div className="today-header__meter"><ProgressBar value={stats.todayRate} ariaLabel="오늘 완료율" /></div>
            </>
          ) : null}
          {highPriorityCount > 0 ? <span className="text-warning">높은 우선순위 {highPriorityCount}</span> : null}
          {deadlineAttentionCount > 0 ? <span className="text-danger">마감 주의 {deadlineAttentionCount}</span> : null}
          {stats.todayActive > 0 && onOpenDayClose ? (
            <button type="button" className="today-header__action" onClick={onOpenDayClose}
              title="명시적으로 선택한 일정만 내일이나 언젠가로 이동합니다">
              <MoonStar size={14} className="text-warning" />오늘 정리
            </button>
          ) : null}
        </div>
      </header>

      <div className="today-workspace grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_230px]">
        <div className="min-w-0 space-y-3">

          {focusedTodos.length ? (
            <section className="today-focus-section" aria-labelledby="today-focus-title">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 id="today-focus-title" className="inline-flex items-center gap-2 text-sm font-semibold text-ui-text"><Star size={15} className="text-warning" />오늘의 핵심 작업</h3>
                </div>
                <span className="text-xs font-medium tabular-nums text-ui-muted">{focusedTodos.length} / 3 선택</span>
              </div>
              {focusedTodos.map((todo) => renderTodo(todo,
                <button type="button" className="icon-btn h-10 w-10 shrink-0 text-warning" onClick={() => toggleFocus(todo.id)} title="핵심 작업에서 제외" aria-label={`${todo.title} 핵심 작업에서 제외`}><StarOff size={16} /></button>,
              ))}
            </section>
          ) : null}

          <section className="today-task-section space-y-2" aria-label="오늘 Todo">
            <div className="today-task-heading">
              <h3 className="text-[17px] font-semibold tracking-tight text-ui-text">할 일</h3>
              <span className="today-task-count">{todayTodos.length}개</span>
            </div>
            {hasTodayTodos ? (
              <div className="today-category-nav sticky top-[60px] z-20 border-b border-ui-divider bg-ui-canvas py-1">
                <div className="flex items-center gap-2">
                  <div className="min-w-0 flex-1 overflow-x-auto pb-0.5">
                    <div className="flex w-max gap-1.5 pr-2" aria-label="오늘 Todo 카테고리 필터">
                      <button type="button" className={`${categoryButtonClass} ${activeCategoryId === "all" ? activeCategoryButtonClass : idleCategoryButtonClass}`} onClick={() => setActiveCategoryId("all")} aria-pressed={activeCategoryId === "all"}>
                        전체 <span className="opacity-75">{todayTodos.length}</span>
                      </button>
                      {visibleCategories.map((category) => (
                        <button key={category.id} type="button" className={`${categoryButtonClass} ${activeCategoryId === category.id ? activeCategoryButtonClass : idleCategoryButtonClass}`} onClick={() => setActiveCategoryId(category.id)} aria-pressed={activeCategoryId === category.id} title={category.description || category.name}>
                          <IconRenderer
                            icon={category.icon}
                            color={category.color || "#b0b0b6"}
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
                        <button type="button" className={`${categoryButtonClass} ${activeCategoryId === "uncategorized" ? activeCategoryButtonClass : idleCategoryButtonClass}`} onClick={() => setActiveCategoryId("uncategorized")} aria-pressed={activeCategoryId === "uncategorized"}>
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
            ) : (
              <div className="flex justify-end">
                <button type="button" className="inline-flex min-h-9 items-center gap-2 rounded-md px-2.5 text-xs font-semibold text-ink-300 hover:bg-ink-800/60 hover:text-ink-100"
                  onClick={() => setShowCategoryManager(true)}>
                  <Settings2 size={15} />카테고리 관리
                </button>
              </div>
            )}


            {hasTodayTodos ? (
              <>

                {remainingTodos.length ? (
                  <div className="border-t border-[var(--ui-row-divider)]">{remainingTodos.map((todo) => renderTodo(todo,
                    <button type="button" className="icon-btn h-10 w-10 shrink-0 text-ui-muted hover:text-warning" onClick={() => toggleFocus(todo.id)} disabled={focusedTodos.length >= 3} title={focusedTodos.length >= 3 ? "핵심 작업은 최대 3개까지 지정할 수 있습니다." : "핵심 작업으로 고정"} aria-label={`${todo.title} 핵심 작업으로 고정`}><Star size={16} /></button>,
                  ))}</div>
                ) : activeTodos.length ? (
                  <p className="py-2 text-xs text-ink-400">미완료 Todo는 상단 핵심 작업에 모두 표시되어 있습니다.</p>
                ) : (
                  <p className={`border-t border-ink-700/35 px-1 py-5 text-sm ${activeCategoryId === "all" && !stats.todayActive ? "text-ink-200" : "text-ink-300"}`}>{activeCategoryId === "all" && !stats.todayActive ? "오늘의 할 일을 모두 완료했습니다." : "선택한 카테고리에 미완료 Todo가 없습니다."}</p>
                )}
              </>
            ) : <div className="today-empty-state">
              <span className="today-empty-state__index">첫 작업</span>
              <p className="mt-2 text-base font-semibold text-ui-text">오늘 할 일을 정해 보세요.</p>
              <p className="mt-1.5 text-sm text-ui-secondary">아래의 할 일 추가로 시작하거나 캘린더에서 날짜를 지정할 수 있습니다.</p>
            </div>}

            <div className="today-composer">
              <TodoForm onAdd={onAdd} defaultDate={today} defaultCategoryId={inlineCategoryId}
                lockCategory={lockInlineCategory} compact collapsible
                submitLabel={lockInlineCategory ? `${activeCategoryName}에 추가` : "추가"}
                categories={categories} projects={activeProjects} showSyntaxHint={false} />
            </div>

            {completedTodos.length ? (
              <div className="border-t border-ui-divider pt-2">
                <button type="button" className="flex min-h-9 w-full items-center justify-between rounded-md px-2 text-sm font-semibold text-ink-500 transition hover:bg-ink-900/70 hover:text-ink-200" onClick={() => setShowCompleted((value) => !value)} aria-expanded={showCompleted}>
                  <span className="inline-flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-success" />완료한 일 {completedTodos.length}개</span>
                  <ChevronDown size={15} className={`transition ${showCompleted ? "rotate-180" : ""}`} />
                </button>
                {showCompleted ? <div className="mt-1.5 space-y-1.5">{completedTodos.map(renderTodo)}</div> : null}
              </div>
            ) : null}
            {upcomingTodos.length > 0 ? (
              <section className="today-upcoming border-t border-ui-divider pt-3" aria-labelledby="today-upcoming-heading">
                <div className="flex items-baseline justify-between gap-3">
                  <h3 id="today-upcoming-heading" className="text-sm font-semibold text-ui-text">다가오는 일정</h3>
                  <span className="text-xs text-ui-muted">다음 작업 미리보기</span>
                </div>
                <div className="mt-2">
                  {upcomingTodos.slice(0, 3).map((todo) => (
                    <button key={todo.id} type="button" onClick={() => setEditingTodo(todo)}
                      className="flex min-h-10 w-full items-center justify-between gap-3 border-b border-ui-divider/60 px-1 text-left text-sm hover:bg-ui-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ui-focus">
                      <span className="min-w-0 truncate text-ui-secondary">{todo.title}</span>
                      <span className="shrink-0 text-xs tabular-nums text-ui-muted">{formatKoreanDate(todo.date, "M월 d일")}</span>
                    </button>
                  ))}
                </div>
              </section>
            ) : null}
          </section>
        </div>

        <aside className="today-sidebar space-y-4 xl:sticky xl:top-20" aria-label="일정 요약">
          <section className="today-sidebar__section space-y-3" aria-labelledby="week-summary-title">
            <div className="today-sidebar__heading"><h3 id="week-summary-title">이번 주</h3></div>
            <p className="today-sidebar__rate"><strong className={stats.weekRate > 0 ? "text-success" : undefined}>{formatCompletionRate(stats.weekTotal, stats.weekRate)}</strong><span>완료율</span></p>
            <p className="today-sidebar__caption">이번 주 일정 {stats.weekTotal}개 기준</p>
          </section>
          {overdueTodos.length > 0 ? <section className="today-sidebar__overdue space-y-3" aria-labelledby="overdue-summary-title">
            <h3 id="overdue-summary-title" className="inline-flex items-center gap-2 text-sm font-bold text-danger"><History size={16} />지난 일정</h3>
            <p className="text-sm text-ink-200">미완료 작업 <strong className="text-danger">{overdueTodos.length}개</strong></p>
            <p className="text-xs text-ink-400">가장 오래된 일정 {oldestOverdueDate ? formatKoreanDate(oldestOverdueDate, "M월 d일") : "-"}</p>
            <button type="button" className="btn-secondary w-full text-xs" onClick={() => setShowOverdueImport(true)}>지난 일정 정리</button>
          </section> : null}

        </aside>
      </div>

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

      {showOverdueImport ? <OverdueTodoImportModal todos={overdueTodos} onImport={onBringOverdueTodos} onDeleteMany={onDeleteMany} onClose={() => setShowOverdueImport(false)} /> : null}
    </div>
  );
}
