import { useEffect, useMemo, useState } from "react";
import { ChevronDown, History, Settings2, Star, StarOff } from "lucide-react";
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

const categoryButtonClass = "inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-md border px-2.5 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/35";
const activeCategoryButtonClass = "border-accent-500/40 bg-accent-500/[0.08] text-accent-200";
const idleCategoryButtonClass = "border-ink-700/60 bg-ink-900/60 text-ink-400 hover:border-ink-600 hover:bg-ink-800/70 hover:text-ink-100";
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
    <div className="mx-auto w-full max-w-[1280px] space-y-5">
      <section className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-ink-100">오늘</h2>
          <p className="mt-1 text-sm text-ink-400">{formatKoreanDate(today, "M월 d일 EEEE")}</p>
        </div>
        <span className="text-xs text-ink-500" title="Todo Planner의 하루는 오전 3시에 바뀝니다.">
          하루 전환 오전 3시
        </span>
      </section>

      <section className="app-card overflow-hidden" aria-labelledby="today-summary-title">
        <div className="grid divide-y divide-ink-700/50 sm:grid-cols-[1.4fr_1fr_1fr] sm:divide-x sm:divide-y-0">
          <div className="border-l-2 border-accent-300 p-4">
            <h3 id="today-summary-title" className="text-xs font-semibold text-ink-400">오늘 남은 할 일</h3>
            <p className="mt-1 text-3xl font-bold tabular-nums text-ink-100">{stats.todayActive}<span className="ml-1.5 text-sm font-medium text-ink-400">개</span></p>
            <p className="mt-1 text-xs text-ink-500">{hasTodayTodos ? `${stats.todayCompleted} / ${stats.todayTotal}개 완료` : "첫 할 일을 아래에서 추가하세요."}</p>
          </div>
          <div className="p-4">
            <p className="text-xs font-semibold text-ink-400">높은 우선순위</p>
            <p className={`mt-1 text-2xl font-bold tabular-nums ${highPriorityCount ? "text-danger" : "text-ink-300"}`}>{highPriorityCount}<span className="ml-1.5 text-sm font-medium text-ink-400">개</span></p>
            <p className="mt-2 text-xs text-ink-500">먼저 처리할 중요한 작업</p>
          </div>
          <div className="p-4">
            <p className="text-xs font-semibold text-ink-400">마감 주의</p>
            <p className={`mt-1 text-2xl font-bold tabular-nums ${deadlineAttentionCount ? "text-warning" : "text-ink-300"}`}>{deadlineAttentionCount}<span className="ml-1.5 text-sm font-medium text-ink-400">개</span></p>
            <p className="mt-2 text-xs text-ink-500">오늘 작업 중 마감 임박·초과</p>
          </div>
        </div>
        {hasTodayTodos ? <div className="border-t border-ink-700/50 px-4 py-3"><ProgressBar value={stats.todayRate} label="오늘 완료율" /></div> : null}
      </section>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_260px]">
        <div className="min-w-0 space-y-4">

          {focusedTodos.length ? (
            <section className="app-card space-y-2 border-warning/30 p-4" aria-labelledby="today-focus-title">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 id="today-focus-title" className="inline-flex items-center gap-2 text-sm font-bold text-ink-100"><Star size={15} className="text-amber-200" />오늘의 핵심 작업</h3>
                <span className="text-xs text-ink-400">{focusedTodos.length} / 3개 선택</span>
              </div>
              {focusedTodos.map((todo) => (
                <div key={todo.id} className="flex items-center gap-2">
                  <button type="button" className="icon-btn h-9 w-9 shrink-0 text-amber-200" onClick={() => toggleFocus(todo.id)} title="핵심 작업에서 제외" aria-label={`${todo.title} 핵심 작업에서 제외`}><StarOff size={16} /></button>
                  <div className="min-w-0 flex-1">{renderTodo(todo)}</div>
                </div>
              ))}
            </section>
          ) : null}

          <section className="app-card space-y-4 p-4" aria-label="오늘 Todo">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-base font-bold text-ink-100">할 일</h3>
              <span className="text-xs text-ink-500">{todayTodos.length}개 등록</span>
            </div>
            {hasTodayTodos ? (
              <div className="sticky top-[60px] z-20 rounded-lg border border-ink-700/50 bg-ink-900/95 p-1.5 backdrop-blur-xl">
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

            {hasTodayTodos ? (
              <>
                <div className="flex flex-wrap items-end justify-between gap-x-3 gap-y-1">
                  <h3 id="today-todo-list-title" className="text-sm font-bold text-ink-100">{activeCategoryName} 할 일</h3>
                  <span className="text-xs font-semibold text-ink-400">미완료 {activeTodos.length}개 · 완료 {completedTodos.length}개</span>
                </div>

                {remainingTodos.length ? (
                  <div className="space-y-1.5">{remainingTodos.map((todo) => (
                    <div key={todo.id} className="flex items-center gap-2">
                      <button type="button" className="icon-btn h-9 w-9 shrink-0 text-ink-400 hover:text-amber-200" onClick={() => toggleFocus(todo.id)} disabled={focusedTodos.length >= 3} title={focusedTodos.length >= 3 ? "핵심 작업은 최대 3개까지 지정할 수 있습니다." : "핵심 작업으로 고정"} aria-label={`${todo.title} 핵심 작업으로 고정`}><Star size={16} /></button>
                      <div className="min-w-0 flex-1">{renderTodo(todo)}</div>
                    </div>
                  ))}</div>
                ) : activeTodos.length ? (
                  <p className="py-2 text-xs text-ink-400">미완료 Todo는 상단 핵심 작업에 모두 표시되어 있습니다.</p>
                ) : (
                  <p className={`rounded-lg border px-3 py-4 text-sm ${activeCategoryId === "all" && !stats.todayActive ? "border-success/30 bg-success/10 text-success" : "border-ink-700/50 text-ink-300"}`}>{activeCategoryId === "all" && !stats.todayActive ? "오늘의 할 일을 모두 완료했습니다." : "선택한 카테고리에 미완료 Todo가 없습니다."}</p>
                )}
              </>
            ) : <div className="rounded-lg border border-dashed border-ink-700 px-4 py-6 text-center">
              <p className="text-sm font-semibold text-ink-200">오늘 할 일을 정해 보세요.</p>
              <p className="mt-1.5 text-xs text-ink-400">위 입력창에 바로 추가하거나 받은함의 작업을 오늘로 옮길 수 있습니다.</p>
            </div>}

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
        </div>

        <aside className="space-y-4" aria-label="일정 요약">
          <section className="app-card space-y-3 p-4" aria-labelledby="week-summary-title">
            <h3 id="week-summary-title" className="text-sm font-bold text-ink-100">이번 주</h3>
            <p className="text-2xl font-bold tabular-nums text-ink-100">{formatCompletionRate(stats.weekTotal, stats.weekRate)}<span className="ml-2 text-xs font-medium text-ink-400">완료율</span></p>
            <ProgressBar value={stats.weekRate} empty={!stats.weekTotal} label="주간 진행률" emptyLabel="등록된 작업 없음" />
            <p className="text-xs text-ink-500">이번 주 일정 {stats.weekTotal}개 기준</p>
          </section>
          {overdueTodos.length > 0 ? <section className="app-card space-y-3 border-warning/30 p-4" aria-labelledby="overdue-summary-title">
            <h3 id="overdue-summary-title" className="inline-flex items-center gap-2 text-sm font-bold text-warning"><History size={16} />지난 일정</h3>
            <p className="text-sm text-ink-200">미완료 작업 <strong className="text-warning">{overdueTodos.length}개</strong></p>
            <p className="text-xs text-ink-400">가장 오래된 일정 {oldestOverdueDate ? formatKoreanDate(oldestOverdueDate, "M월 d일") : "-"}</p>
            <button type="button" className="btn-secondary w-full text-xs" onClick={() => setShowOverdueImport(true)}>지난 일정 가져오기</button>
          </section> : null}
          <div className="px-1 text-xs leading-6 text-ink-500">
            <p className="inline-flex items-center gap-1.5 font-semibold text-ink-400"><Star size={13} className="text-warning" />핵심 작업은 최대 3개</p>
            <p>별표로 오늘 집중할 작업을 위에 고정하세요. 완료한 작업은 접어 두고 필요할 때 펼칠 수 있습니다.</p>
          </div>
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
