import { useEffect, useMemo, useState, type ReactNode } from "react";
import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ChevronDown, GripVertical, History, MoonStar, PanelRightOpen, Settings2, Star, X } from "lucide-react";
import { Button } from "../components/ui/Button";
import { IconButton } from "../components/ui/IconButton";
import { IconRenderer } from "../components/common/IconRenderer";
import { TodayCategoryManager } from "../components/today/TodayCategoryManager";
import { OverdueTodoImportModal } from "../components/todo/OverdueTodoImportModal";
import { TodoEditModal } from "../components/todo/TodoEditModal";
import { TodoForm } from "../components/todo/TodoForm";
import { TodoRow } from "../components/todo/TodoRow";
import { formatKoreanDate, todayKey } from "../lib/date";
import { formatCompletionRate } from "../lib/todo";
import type { OverdueTodoImportMode, OverdueTodoImportResult } from "../lib/todoRecovery";
import type { Category } from "../types/category";
import type { Project } from "../types/project";
import type { Todo, TodoInput } from "../types/todo";

type TodayPageProps = {
  todayTodos: Todo[];
  candidateTodos: Todo[];
  onPlanTodoToToday: (todo: Todo) => Promise<boolean>;
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
  onReorderTodos: (ids: string[]) => Promise<boolean>;
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

const categoryButtonClass = "inline-flex min-h-9 shrink-0 items-center gap-1.5 border-b-2 px-2 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ui-focus";
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

function SortableTodayRow({ todo, render }: {
  todo: Todo;
  render: (todo: Todo, handle?: ReactNode) => ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: todo.id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  const handle = (
    <button
      type="button"
      {...attributes}
      {...listeners}
      className="today-drag-handle inline-flex h-9 w-7 cursor-grab items-center justify-center text-ui-muted hover:text-ui-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ui-focus active:cursor-grabbing"
      aria-label={`"${todo.title}" 순서 변경`}
      title="드래그하거나 방향키로 순서 변경"
    >
      <GripVertical size={15} aria-hidden="true" />
    </button>
  );
  return (
    <div ref={setNodeRef} style={style} className={isDragging ? "relative z-20 bg-ui-elevated opacity-90" : ""}>
      {render(todo, handle)}
    </div>
  );
}

export function TodayPage({
  todayTodos,
  candidateTodos,
  onPlanTodoToToday,
  onOpenDayClose,
  stats,
  onAdd,
  onToggle,
  onDelete,
  onDeleteMany,
  onUpdate,
  onReorderTodos,
  categories = [],
  projects = [],
  onAddCategory,
  onUpdateCategory,
  onDeleteCategory,
  onReorderCategories,
  overdueTodos,
  onBringOverdueTodos,
}: TodayPageProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const [showOverdueImport, setShowOverdueImport] = useState(false);
  const [activeCategoryId, setActiveCategoryId] = useState<CategoryFilter>("all");
  const [editingTodo, setEditingTodo] = useState<Todo | null>(null);
  const [showCompleted, setShowCompleted] = useState(false);
  const [focusIds, setFocusIds] = useState<string[]>(() => readFocusIds(todayKey()));
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const [planningTodoId, setPlanningTodoId] = useState<string | null>(null);
  const [planningError, setPlanningError] = useState("");
  const [planningOpen, setPlanningOpen] = useState(false);
  useEffect(() => {
    if (!planningOpen) return;
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPlanningOpen(false);
    };
    window.addEventListener("keydown", onEscape);
    return () => window.removeEventListener("keydown", onEscape);
  }, [planningOpen]);

  const today = todayKey();
  const focusedTodos = useMemo(() => focusIds.map((id) => todayTodos.find((todo) => todo.id === id)).filter((todo): todo is Todo => Boolean(todo && !todo.completed && !todo.archived)), [focusIds, todayTodos]);
  const focusSet = useMemo(() => new Set(focusedTodos.map((todo) => todo.id)), [focusedTodos]);
  const oldestOverdueDate = overdueTodos[0]?.date;
  const hasPlanningContent = candidateTodos.length > 0 || overdueTodos.length > 0 || stats.weekTotal > 0;
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
  // Preselect the active filter, but allow an explicit category choice in the inline composer.
  const inlineCategoryId = activeCategoryId === "all" || activeCategoryId === "uncategorized" ? "" : activeCategoryId;

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

  const planToday = async (todo: Todo) => {
    if (planningTodoId) return;
    setPlanningTodoId(todo.id);
    setPlanningError("");
    try {
      const succeeded = await onPlanTodoToToday(todo);
      if (!succeeded) setPlanningError("작업을 오늘로 이동하지 못했습니다. 다시 시도해 주세요.");
    } catch {
      setPlanningError("작업 이동에 실패했습니다. 연결 상태를 확인해 주세요.");
    } finally {
      setPlanningTodoId(null);
    }
  };

  const renderTodo = (todo: Todo, dragHandle?: ReactNode) => (
    <TodoRow
      key={todo.id}
      todo={todo}
      leadingAction={dragHandle}
      variant="today"
      focusPinned={focusSet.has(todo.id)}
      focusDisabled={!focusSet.has(todo.id) && focusedTodos.length >= 3}
      onToggleFocus={toggleFocus}
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

  const handleTodoDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const ids = remainingTodos.map((todo) => todo.id);
    const from = ids.indexOf(String(active.id));
    const to = ids.indexOf(String(over.id));
    if (from < 0 || to < 0) return;
    void onReorderTodos(arrayMove(ids, from, to));
  };

  return (
    <div className={`page-shell today-page ${planningOpen ? "today-page--planning" : ""}`}>
      <header className="today-header">
        <div className="today-header__identity">
          <h1>오늘</h1>
          <span>{formatKoreanDate(today, "M월 d일 EEEE")}</span>
        </div>
        <div className="today-header__status" role="group" aria-label="오늘 작업 현황">
          <span className="today-header__completion"><strong>{stats.todayCompleted}</strong> / {stats.todayTotal} 완료</span>
          <button type="button" className="today-plan-toggle" aria-label="오늘 계획하기"
            aria-expanded={planningOpen} aria-controls={planningOpen ? "today-plan-panel" : undefined}
            onClick={() => setPlanningOpen((open) => !open)}>
            <PanelRightOpen size={15} aria-hidden="true" />
            계획하기
            {overdueTodos.length > 0 ? <span className="today-plan-toggle__count" aria-hidden="true">{overdueTodos.length}</span> : null}
          </button>
          {stats.todayActive > 0 && onOpenDayClose ? (
            <Button variant="warning" size="sm" className="today-header__action" onClick={onOpenDayClose}
              title="명시적으로 선택한 일정만 내일이나 언젠가로 이동합니다">
              <MoonStar size={15} aria-hidden="true" />오늘 정리
            </Button>
          ) : null}
        </div>
      </header>

      <div className={`today-workspace ${planningOpen ? "today-workspace--planning" : "today-workspace--single"}`}>
        <main className="today-workspace__main min-w-0 space-y-3">
          <section className="today-capture-section" aria-label="빠른 작업 입력">
            <div className="today-composer today-quick-capture">
              <TodoForm onAdd={onAdd} defaultDate={today} defaultCategoryId={inlineCategoryId}
                compact collapsible alwaysOpen submitLabel="추가"
                categories={categories} projects={activeProjects} showSyntaxHint={false} />
            </div>
          </section>
          {focusedTodos.length ? (
            <section className="today-focus-section" aria-labelledby="today-focus-title">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 id="today-focus-title" className="inline-flex items-center gap-2 text-sm font-semibold text-ui-text"><Star size={15} className="text-warning" />오늘의 핵심 작업</h3>
                </div>
                <span className="text-xs font-medium tabular-nums text-ui-muted">{focusedTodos.length} / 3 선택</span>
              </div>
              <div className="today-focus-list">{focusedTodos.map((todo) => renderTodo(todo))}</div>
            </section>
          ) : null}

          <section className="today-task-section space-y-2" aria-label="오늘 Todo">
            <div className="today-task-heading">
              <h3 className="text-[17px] font-semibold tracking-tight text-ui-text">{focusedTodos.length ? "나머지 할 일" : "오늘 할 일"}</h3>
              {activeTodos.length > 1 ? <span className="today-task-count">{activeTodos.length}개 남음</span> : null}
            </div>
            {hasTodayTodos ? (
              <div className="today-category-nav border-b border-ui-divider bg-ui-canvas py-1">
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
                  <IconButton label="카테고리 관리" onClick={() => setShowCategoryManager(true)} title="카테고리 관리" size="md" className="shrink-0">
                    <Settings2 size={16} />
                  </IconButton>
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
                  <div className="border-t border-[var(--ui-row-divider)]">
                    {remainingTodos.length > 1 ? (
                      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleTodoDragEnd}>
                        <SortableContext items={remainingTodos.map((todo) => todo.id)} strategy={verticalListSortingStrategy}>
                          {remainingTodos.map((todo) => <SortableTodayRow key={todo.id} todo={todo} render={renderTodo} />)}
                        </SortableContext>
                      </DndContext>
                    ) : remainingTodos.map((todo) => renderTodo(todo))}
                  </div>
                ) : activeTodos.length ? (
                  <p className="py-2 text-xs text-ink-400">미완료 Todo는 상단 핵심 작업에 모두 표시되어 있습니다.</p>
                ) : (
                  <p className={`border-t border-ink-700/35 px-1 py-5 text-sm ${activeCategoryId === "all" && !stats.todayActive ? "text-ink-200" : "text-ink-300"}`}>{activeCategoryId === "all" && !stats.todayActive ? "오늘의 할 일을 모두 완료했습니다." : "선택한 카테고리에 미완료 Todo가 없습니다."}</p>
                )}
              </>
            ) : <div className="today-empty-state" role="status">
              오늘 예정된 일이 없습니다. 새로 입력하거나 기존 작업에서 선택할 수 있습니다.
              {!hasPlanningContent ? <a className="today-planning-panel__all-link block" href="#/all">전체 Todo에서 찾기</a> : null}
            </div>}



            {completedTodos.length ? (
              <div className="border-t border-ui-divider pt-2">
                <button type="button" className="flex min-h-9 w-full items-center justify-between rounded-md px-2 text-sm font-semibold text-ink-500 transition hover:bg-ink-900/70 hover:text-ink-200" onClick={() => setShowCompleted((value) => !value)} aria-expanded={showCompleted}>
                  <span className="inline-flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-success" />완료한 일 {completedTodos.length}개</span>
                  <ChevronDown size={15} className={`transition ${showCompleted ? "rotate-180" : ""}`} />
                </button>
                {showCompleted ? <div className="mt-1.5 space-y-1.5">{completedTodos.map((todo) => renderTodo(todo))}</div> : null}
              </div>
            ) : null}
          </section>
        </main>
        {planningOpen ? (
          <>
          <button className="today-planning-backdrop" type="button" aria-label="계획 패널 바깥 영역 닫기"
            onClick={() => setPlanningOpen(false)} />
          <aside id="today-plan-panel" className="today-planning-panel" aria-label="오늘 계획하기">
            <div className="today-planning-panel__header">
              <div className="flex items-center justify-between gap-3">
                <h2>오늘 계획하기</h2>
                <button type="button" className="today-plan-close" onClick={() => setPlanningOpen(false)}
                  aria-label="계획 패널 닫기"><X size={17} aria-hidden="true" /></button>
              </div>
              <p>기존 작업을 선택해 오늘의 계획을 만듭니다.</p>
            </div>

            {candidateTodos.length > 0 ? (
              <section className="today-planning-panel__section" aria-label="다음 작업 후보">
                <div className="today-planning-panel__section-title">
                  <h3>다음 작업 후보</h3>
                  <span>{candidateTodos.length}개 표시</span>
                </div>
                <p className="today-planning-panel__hint">오늘로 이동하면 실행 날짜만 바뀌며 마감일은 유지됩니다.</p>
                <ul className="today-candidate-list">
                  {candidateTodos.map((todo) => (
                    <li key={todo.id} className="today-candidate">
                      <div className="today-candidate__content">
                        <span className="today-candidate__title">{todo.title}</span>
                        <span className="today-candidate__meta">
                          {todo.planningState === "SCHEDULED"
                            ? `${formatKoreanDate(todo.date, "M월 d일")} 예정`
                            : todo.planningState === "SOMEDAY" ? "언젠가" : "미계획"}
                          {todo.projectId && projectById.get(todo.projectId)
                            ? ` · ${projectById.get(todo.projectId)?.name}` : ""}
                          {todo.dueDate ? ` · 마감 ${formatKoreanDate(todo.dueDate, "M월 d일")}` : ""}
                        </span>
                      </div>
                      <button type="button" className="today-candidate__move"
                        onClick={() => void planToday(todo)}
                        disabled={planningTodoId !== null}
                        aria-label={`"${todo.title}" 오늘로 이동`}>
                        {planningTodoId === todo.id ? "이동 중" : "오늘로"}
                      </button>
                    </li>
                  ))}
                </ul>
                {planningError ? <p role="alert" className="today-planning-panel__error">{planningError}</p> : null}
              </section>
            ) : null}

            {overdueTodos.length > 0 ? (
              <section className="today-planning-panel__section" aria-labelledby="overdue-summary-title">
                <div className="today-planning-panel__section-title">
                  <h3 id="overdue-summary-title">지난 일정</h3>
                  <span className="today-planning-panel__overdue-count">{overdueTodos.length}개</span>
                </div>
                <p className="today-planning-panel__hint">
                  {oldestOverdueDate ? `${formatKoreanDate(oldestOverdueDate, "M월 d일")}부터 남은 작업입니다.` : "이전 작업을 검토합니다."}
                  {" "}선택한 항목만 이동합니다.
                </p>
                <Button variant="secondary" size="sm" className="today-plan-review"
                  onClick={() => setShowOverdueImport(true)}>
                  <History size={14} aria-hidden="true" /> 지난 작업 검토
                </Button>
              </section>
            ) : null}

            {stats.weekTotal > 0 ? (
              <section className="today-planning-panel__section" aria-label="이번 주 요약">
                <div className="today-planning-panel__section-title">
                  <h3>이번 주</h3>
                  <span>{stats.weekTotal}개 일정</span>
                </div>
                <div className="today-plan-week">
                  <span className="today-plan-week__rate">{formatCompletionRate(stats.weekTotal, stats.weekRate)}</span>
                  <div className="today-plan-week__track" aria-hidden="true">
                    <span style={{ width: `${Math.max(0, Math.min(100, stats.weekRate))}%` }} />
                  </div>
                </div>
              </section>
            ) : null}

            <a className="today-planning-panel__all-link" href="#/all">전체 Todo에서 작업 찾기</a>
          </aside>
          </>
        ) : null}
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
