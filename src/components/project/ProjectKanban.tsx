import { DndContext, DragOverlay, PointerSensor, pointerWithin, rectIntersection, useDraggable, useDroppable, useSensor, useSensors, type CollisionDetection, type DragEndEvent, type DragStartEvent } from "@dnd-kit/core";
import { ChevronDown, ChevronRight, GripVertical, MoreHorizontal, Plus, Search } from "lucide-react";
import { memo, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { TodoForm } from "../todo/TodoForm";
import { exceedsWipLimit, toggleDoneColumnCollapsed } from "../../lib/projectWorkflow";
import { formatKoreanDate, todayKey } from "../../lib/date";
import { isDueSoon, isOverdueByDeadline } from "../../lib/todo";
import { workflowStatusLabels } from "../../lib/todoLabels";
import type { Category } from "../../types/category";
import type { Milestone, Project } from "../../types/project";
import type { Todo, TodoInput, TodoWorkflowStatus } from "../../types/todo";
import { Modal } from "../common/Modal";
import { TodoEditModal } from "../todo/TodoEditModal";
import { TimerToggleButton } from "../timer/TimerToggleButton";

const workflowColumns: Array<{ status: TodoWorkflowStatus; label: string }> = [
  { status: "TODO", label: workflowStatusLabels.TODO },
  { status: "IN_PROGRESS", label: "진행 중" },
  { status: "BLOCKED", label: "보류" },
  { status: "DONE", label: "완료" },
];

type ProjectKanbanProps = {
  project: Project;
  todos: Todo[];
  milestones: Milestone[];
  categories?: Category[];
  projects?: Project[];
  onAddTodo: (input: TodoInput) => Promise<Todo | undefined> | Todo | undefined;
  onUpdateTodo: (id: string, input: Partial<Omit<Todo, "id" | "createdAt">>) => Promise<Todo | undefined> | Todo | undefined;
  onToggleTodo: (id: string) => void;
  onDeleteTodo: (id: string) => void;
  onDetachTodo: (id: string, projectId: string, includeChildren: boolean) => Promise<boolean>;
  /** Persists a new relative order for the given Todo ids (the visible cards of one column). */
  onReorderTodos: (ids: string[]) => Promise<boolean>;
  /** WIP limits are saved with the planner settings so they follow the user across browsers. */
  wipLimits: ProjectWipLimits;
  onChangeWipLimits: (next: ProjectWipLimits) => void;
};

const statusOf = (todo: Todo): TodoWorkflowStatus => todo.workflowStatus || (todo.completed ? "DONE" : "TODO");

// Pointer location, rather than the nearest column's center, decides the drop.
// Rect intersection is the fallback for keyboard/synthetic drag interactions.
const columnCollision: CollisionDetection = (args) => {
  const pointer = pointerWithin(args);
  // A card under the pointer means "insert here"; otherwise the column itself is the target.
  const card = pointer.find(({ id }) => String(id).startsWith("card:"));
  if (card) return [card];
  return pointer.length ? pointer : rectIntersection(args);
};
/** Groups a column's cards by milestone (project milestone order first, unassigned last). */
function groupByMilestoneOrder(items: Todo[], milestones: Milestone[]) {
  const groups: Array<{ key: string; title: string; items: Todo[] }> = milestones
    .map((milestone) => ({ key: milestone.id, title: milestone.title, items: items.filter((todo) => todo.milestoneId === milestone.id) }))
    .filter((group) => group.items.length);
  const known = new Set(milestones.map(({ id }) => id));
  const rest = items.filter((todo) => !todo.milestoneId || !known.has(todo.milestoneId));
  if (rest.length) groups.push({ key: "none", title: "마일스톤 없음", items: rest });
  return groups;
}
const byOrder = (a: Todo, b: Todo) => (a.order ?? 0) - (b.order ?? 0) || b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id);
const WIP_LIMITS_KEY = "dark-todo-planner:project-wip-limits";
const DONE_COLUMN_KEY = "dark-todo-planner:collapsed-done-columns";
const COMPACT_KEY = "dark-todo-planner:kanban-compact";
export type WipLimits = Partial<Record<TodoWorkflowStatus, number>>;
export type ProjectWipLimits = Record<string, WipLimits>;

function readWipLimits(): ProjectWipLimits {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(WIP_LIMITS_KEY) || "{}");
    if (!stored || typeof stored !== "object" || Array.isArray(stored)) return {};
    return Object.fromEntries(Object.entries(stored).map(([projectId, rawLimits]) => {
      if (!rawLimits || typeof rawLimits !== "object" || Array.isArray(rawLimits)) return [projectId, {}];
      const limits = Object.fromEntries(Object.entries(rawLimits).filter((entry): entry is [TodoWorkflowStatus, number] =>
        workflowColumns.some((column) => column.status === entry[0]) && Number.isInteger(entry[1]) && Number(entry[1]) > 0,
      ));
      return [projectId, limits];
    }));
  } catch {
    return {};
  }
}

function readCompact(): boolean {
  try { return localStorage.getItem(COMPACT_KEY) === "1"; } catch { return false; }
}

function readCollapsedDoneColumns(): Record<string, boolean> {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(DONE_COLUMN_KEY) || "{}");
    if (!stored || typeof stored !== "object" || Array.isArray(stored)) return {};
    return Object.fromEntries(Object.entries(stored).filter((entry): entry is [string, boolean] => typeof entry[1] === "boolean"));
  } catch {
    return {};
  }
}

function KanbanColumn({ status, label, count, visibleCount, wipLimit, onWipLimitChange, collapsed = false, onToggleCollapse, children }: {
  status: TodoWorkflowStatus;
  label: string;
  count: number;
  visibleCount: number;
  wipLimit?: number;
  onWipLimitChange: (status: TodoWorkflowStatus, limit: number) => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  children: ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `column:${status}` });
  const overLimit = exceedsWipLimit(count, wipLimit);
  return (
    <section ref={setNodeRef} data-status={status} data-collapsed={collapsed} data-over-limit={overLimit} data-drag-over={isOver ? "true" : "false"}
      className="project-kanban-column px-3 py-3 transition">
      <div className="project-kanban-column__header">
        <div className="project-kanban-column__identity">
          {onToggleCollapse ? <button type="button" className="inline-flex min-h-9 items-center gap-1 rounded-[4px] px-1 text-sm font-semibold text-ink-100 hover:bg-ink-850 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/70"
            onClick={onToggleCollapse} aria-expanded={!collapsed}>
            {collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}{label}{collapsed ? ` ${count}` : ""}
          </button> : <h4 className="px-1 text-sm font-semibold text-ink-100">{label}</h4>}
          <span className="project-kanban-column__count tabular-nums" aria-label={`${label} 작업 ${count}개`}>{count}</span>
        </div>
        <details className="project-kanban-column__limit">
          <summary title="WIP(Work In Progress) 한도: 현재 작업 수가 아닌 이 열의 최대 작업 수입니다. 초과 시 경고만 표시합니다."
            aria-label={`${label} WIP 한도 설정`}>
            <span>한도</span><span className="tabular-nums">{wipLimit ?? "—"}</span>
          </summary>
          <div className="project-kanban-column__limit-panel">
            <label>
              <span>WIP · 최대 작업 수</span>
              <input type="number" min={0} max={999}
                className="field h-8 min-h-8 w-14 px-1 py-0.5 text-center text-xs"
                value={wipLimit ?? ""} placeholder="—" aria-label={`${label} WIP 한도`}
                onChange={(event) => onWipLimitChange(status, Math.max(0, Math.min(999, Number.parseInt(event.target.value, 10) || 0)))} />
            </label>
            <p>설정한 한도는 브라우저에 저장되며, 0이나 빈칸은 제한 없음입니다. 작업 이동을 차단하지 않습니다.</p>
          </div>
        </details>
      </div>
      {visibleCount !== count ? <p className="project-kanban-column__filtered">현재 필터에 표시된 작업 {visibleCount}개 / 전체 {count}개</p> : null}
      {overLimit ? <p className="mb-2 border-l-2 border-warning/65 py-1 pl-2 text-[11px] font-medium text-warning" role="status">
        WIP 한도 초과 · 작업을 먼저 마무리해 보세요.
      </p> : null}
      {collapsed ? <p className="border-t border-ink-700/35 px-2 py-5 text-center text-xs text-ink-500">
        완료 작업 {count}개 · 열을 펼쳐 확인하세요
      </p> : <div className="project-kanban-column__list space-y-2">{children}</div>}
    </section>
  );
}

const ProjectKanbanCard = memo(function ProjectKanbanCard({ project, todo, parent, childCount, milestone, today, canReposition, onToggleTodo, onOpenDetails, onMove, onReposition, onDetach, onDelete }: {
  project: Project;
  todo: Todo;
  parent?: Todo;
  childCount: number;
  milestone?: Milestone;
  today: string;
  /** Quick "to top / to bottom" actions need a manual order (off while sorted by priority or grouped). */
  canReposition: boolean;
  onToggleTodo: ProjectKanbanProps["onToggleTodo"];
  onOpenDetails: (todo: Todo) => void;
  onMove: (todo: Todo, status: TodoWorkflowStatus) => void;
  onReposition: (todo: Todo, edge: "top" | "bottom") => void;
  onDetach: (todo: Todo) => void;
  onDelete: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef: setDragRef, isDragging } = useDraggable({
    id: todo.id, disabled: project.archived,
  });
  const { setNodeRef: setDropRef, isOver } = useDroppable({ id: `card:${todo.id}`, disabled: project.archived });
  const setNodeRef = useCallback((node: HTMLElement | null) => { setDragRef(node); setDropRef(node); }, [setDragRef, setDropRef]);
  const overdue = isOverdueByDeadline(todo, today);
  const dueSoon = isDueSoon(todo, today);
  const status = statusOf(todo);
  return (
    <article ref={setNodeRef} data-v4-card="true"
      data-dragging={isDragging ? "true" : "false"} data-drop-target={isOver && !isDragging ? "true" : "false"} className="project-kanban-card">
      <div className="project-v4-card__top">
        <button type="button" disabled={project.archived} onClick={() => onToggleTodo(todo.id)}
          className="project-v4-card__check" aria-label={`${todo.title} 완료 토글`}>
          <span className={`block h-4 w-4 rounded-full border ${todo.completed ? "border-success bg-success" : "border-ink-600"}`} aria-hidden="true" />
        </button>
        <div className="min-w-0 flex-1">
          {parent ? <span className="project-v4-card__parent">↳ {parent.title}</span> : null}
          <button type="button" className={`project-v4-card__title ${todo.completed ? "line-through opacity-60" : ""}`}
            onClick={() => onOpenDetails(todo)} title={todo.title}>{todo.title}</button>
        </div>
        {!project.archived ? <TimerToggleButton todo={todo} className="project-v4-card__timer" /> : null}
        {!project.archived ? <button type="button" className="project-v4-card__drag"
          title="잡고 다른 열로 드래그해 상태 변경" aria-label={`${todo.title} 상태 이동`}
          {...listeners} {...attributes}><GripVertical size={15} /></button> : null}
        {!project.archived ? <details className="project-actions-menu" onKeyDown={(event) => {
          if (event.key !== "Escape") return;
          event.currentTarget.open = false;
          event.currentTarget.querySelector("summary")?.focus();
        }}>
          <summary className="icon-btn" aria-label={todo.title + " 작업 메뉴"}><MoreHorizontal size={16} /></summary>
          <div className="project-actions-menu__panel" onClick={(event) => {
            const menu = event.currentTarget.closest("details");
            if (menu) menu.open = false;
          }}>
            {workflowColumns.filter((column) => column.status !== status).map((column) => (
              <button key={column.status} type="button" onClick={() => onMove(todo, column.status)}>{column.label}으로 이동</button>
            ))}
            {canReposition ? <>
              <button type="button" onClick={() => onReposition(todo, "top")}>맨 위로 이동</button>
              <button type="button" onClick={() => onReposition(todo, "bottom")}>맨 아래로 이동</button>
            </> : null}
            <button type="button" onClick={() => onDetach(todo)}>프로젝트에서 제외</button>
            <button type="button" className="project-actions-menu__danger" onClick={() => onDelete(todo.id)}>휴지통으로 이동</button>
          </div>
        </details> : null}
      </div>
      {(todo.priority === "HIGH" || milestone || childCount > 0 || todo.dueDate || todo.planningState === "SCHEDULED" || todo.blockReason) ? (
        <div className="project-v4-card__meta">
          {todo.priority === "HIGH" ? <span className="text-warning">높음</span> : null}
          {milestone ? <span title={milestone.title} className="truncate">{milestone.title}</span> : null}
          {status === "BLOCKED" && todo.blockReason ? <span className="text-danger">{todo.blockReason}</span> : null}
          {childCount ? <span>하위 {childCount}</span> : null}
          {todo.planningState === "SCHEDULED" && todo.date !== "9999-12-31" ? <span>예정 {formatKoreanDate(todo.date, "M/d")}</span> : null}
          {todo.dueDate ? <span className={overdue ? "text-danger" : dueSoon ? "text-warning" : ""}>마감 {todo.dueDate}</span> : null}
        </div>
      ) : null}
    </article>
  );
});

export function ProjectKanban({ project, todos, milestones, categories = [], projects = [], onAddTodo, onUpdateTodo, onToggleTodo, onDeleteTodo, onDetachTodo, onReorderTodos, wipLimits, onChangeWipLimits }: ProjectKanbanProps) {
  const today = todayKey();
  const [addingTo, setAddingTo] = useState<TodoWorkflowStatus | null>(null);
  const [priorityFilter, setPriorityFilter] = useState("ALL");
  const [sortPriority, setSortPriority] = useState(false);
  const [query, setQuery] = useState("");
  const [editingTodoId, setEditingTodoId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [detachTarget, setDetachTarget] = useState<Todo | null>(null);
  const [detaching, setDetaching] = useState(false);
  const [detachFailed, setDetachFailed] = useState(false);
  const editingTodo = todos.find(({ id }) => id === editingTodoId);
  const openDetails = useCallback((todo: Todo) => setEditingTodoId(todo.id), []);
  const openDetach = useCallback((todo: Todo) => {
    setDetachTarget(todo);
    setDetachFailed(false);
  }, []);
  const moveTodoAsync = async (todo: Todo, workflowStatus: TodoWorkflowStatus): Promise<boolean> =>
    Boolean(await onUpdateTodo(todo.id, { workflowStatus, completed: workflowStatus === "DONE" }));
  const moveTodo = (todo: Todo, workflowStatus: TodoWorkflowStatus) => { void moveTodoAsync(todo, workflowStatus); };
  const detach = async (includeChildren: boolean) => {
    if (!detachTarget || detaching) return;
    setDetaching(true);
    try {
      const detached = await onDetachTodo(detachTarget.id, project.id, includeChildren);
      if (detached) setDetachTarget(null);
      else setDetachFailed(true);
    } finally {
      setDetaching(false);
    }
  };
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  // App's undo wrapper changes identity on unrelated re-renders. Keep card
  // callbacks stable so memoized cards do not all re-render on every save.
  const toggleRef = useRef(onToggleTodo);
  toggleRef.current = onToggleTodo;
  const stableToggle = useCallback((id: string) => toggleRef.current(id), []);
  const wipLimitsByProject = wipLimits;
  const [groupByMilestone, setGroupByMilestone] = useState(false);
  const [compact, setCompact] = useState(readCompact);
  const [collapsedDoneColumns, setCollapsedDoneColumns] = useState<Record<string, boolean>>(readCollapsedDoneColumns);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  // One-time move of limits that older versions kept only in this browser.
  useEffect(() => {
    if (Object.keys(wipLimits).length) return;
    const local = readWipLimits();
    if (!Object.keys(local).length) return;
    onChangeWipLimits(local);
    try { localStorage.removeItem(WIP_LIMITS_KEY); } catch { /* nothing to clean up */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    try { localStorage.setItem(DONE_COLUMN_KEY, JSON.stringify(collapsedDoneColumns)); } catch { /* Keep the board usable when browser storage is unavailable. */ }
  }, [collapsedDoneColumns]);

  const toggleCompact = () => setCompact((value) => {
    try { localStorage.setItem(COMPACT_KEY, value ? "0" : "1"); } catch { /* display preference only */ }
    return !value;
  });

  const changeWipLimit = (status: TodoWorkflowStatus, value: number) => {
    const projectLimits = { ...wipLimitsByProject[project.id] };
    if (value === 0) delete projectLimits[status];
    else projectLimits[status] = value;
    const next = { ...wipLimitsByProject };
    if (Object.keys(projectLimits).length) next[project.id] = projectLimits;
    else delete next[project.id];
    onChangeWipLimits(next);
  };

  // Manual card order (saved as each Todo's sort order); priority sort overrides it for display.
  const orderedTodos = useMemo(() => [...todos].sort(byOrder), [todos]);
  const visibleTodos = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    const filtered = orderedTodos.filter((todo) => {
      const matchesQuery = !normalizedQuery || `${todo.title} ${todo.memo || ""}`.toLocaleLowerCase().includes(normalizedQuery);
      return matchesQuery && (priorityFilter === "ALL" || todo.priority === priorityFilter);
    });
    const priorityRank = { HIGH: 0, MEDIUM: 1, LOW: 2 };
    return sortPriority ? filtered.sort((a, b) => priorityRank[a.priority] - priorityRank[b.priority] || a.createdAt.localeCompare(b.createdAt)) : filtered;
  }, [orderedTodos, priorityFilter, query, sortPriority]);

  const indexed = useMemo(() => {
    const todoById = new Map(todos.map((todo) => [todo.id, todo]));
    const milestoneById = new Map(milestones.map((milestone) => [milestone.id, milestone]));
    const childCountByParentId = new Map<string, number>();
    const byStatus = new Map<TodoWorkflowStatus, Todo[]>(workflowColumns.map((column) => [column.status, []]));
    todos.forEach((todo) => {
      if (todo.parentTodoId) childCountByParentId.set(todo.parentTodoId, (childCountByParentId.get(todo.parentTodoId) || 0) + 1);
      byStatus.get(statusOf(todo))?.push(todo);
    });
    return { todoById, milestoneById, childCountByParentId, byStatus };
  }, [milestones, todos]);

  const visibleByStatus = useMemo(() => {
    const map = new Map<TodoWorkflowStatus, Todo[]>(workflowColumns.map((column) => [column.status, []]));
    visibleTodos.forEach((todo) => map.get(statusOf(todo))?.push(todo));
    return map;
  }, [visibleTodos]);

  // Cards stay memoized: the handler reads the latest column lists through a ref.
  const repositionRef = useRef<(todo: Todo, edge: "top" | "bottom") => void>(() => undefined);
  repositionRef.current = (todo, edge) => {
    const column = visibleByStatus.get(statusOf(todo)) ?? [];
    const ids = column.filter(({ id }) => id !== todo.id).map(({ id }) => id);
    if (edge === "top") ids.unshift(todo.id); else ids.push(todo.id);
    if (ids.length > 1) void onReorderTodos(ids);
  };
  const stableReposition = useCallback((todo: Todo, edge: "top" | "bottom") => repositionRef.current(todo, edge), []);

  const onDragStart = useCallback(({ active }: DragStartEvent) => {
    setActiveDragId(String(active.id));
  }, []);
  const onDragCancel = useCallback(() => setActiveDragId(null), []);

  const handleDragEnd = async ({ active, over }: DragEndEvent) => {
    setActiveDragId(null);
    const overId = typeof over?.id === "string" ? over.id : "";
    const todo = indexed.todoById.get(String(active.id));
    if (!todo || project.archived) return;
    let nextStatus: TodoWorkflowStatus;
    let beforeId: string | undefined;
    if (overId.startsWith("card:")) {
      const target = indexed.todoById.get(overId.slice("card:".length));
      if (!target || target.id === todo.id) return;
      nextStatus = statusOf(target);
      beforeId = target.id;
    } else if (overId.startsWith("column:")) {
      nextStatus = overId.slice("column:".length) as TodoWorkflowStatus;
    } else return;
    if (!workflowColumns.some((column) => column.status === nextStatus)) return;
    const statusChanged = statusOf(todo) !== nextStatus;
    // Dropping on a card also fixes the position, unless the board is auto-sorted or grouped.
    const reposition = Boolean(beforeId) && !sortPriority && !groupByMilestone;
    // The lane change is optimistic; only reposition after the server accepted it, so a rejected
    // move keeps its error message and never reorders a card that is back in its old lane.
    if (statusChanged && !await moveTodoAsync(todo, nextStatus)) return;
    if (!reposition || !beforeId) return;
    const column = visibleByStatus.get(nextStatus) ?? [];
    const oldIndex = column.findIndex(({ id }) => id === todo.id);
    const targetIndex = column.findIndex(({ id }) => id === beforeId);
    const ids = column.filter(({ id }) => id !== todo.id).map(({ id }) => id);
    // Moving down inside a column lands after the card dropped on; everything else lands before it.
    const insertAt = ids.indexOf(beforeId) + (!statusChanged && oldIndex >= 0 && oldIndex < targetIndex ? 1 : 0);
    ids.splice(insertAt, 0, todo.id);
    if (ids.length > 1) void onReorderTodos(ids);
  };
  const activeDragTodo = activeDragId ? indexed.todoById.get(activeDragId) : undefined;

  return (
    <section className="space-y-3">
      <div className="flex flex-col gap-3 border-b border-ui-divider pb-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex w-full flex-wrap items-center gap-2 lg:w-auto lg:justify-end">
          <label className="relative w-full sm:w-60">
            <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-500" />
            <input className="field h-9 min-h-9 pl-8 py-1 text-xs" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="프로젝트 작업 검색" aria-label="프로젝트 작업 검색" />
          </label>
          <details className="workspace-board-options">
            <summary className="btn-secondary text-xs">보기 옵션</summary>
            <div className="workspace-board-options__panel">
          <select className="field h-9 min-h-9 w-auto text-xs" value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value)} aria-label="우선순위 필터">
            <option value="ALL">모든 우선순위</option><option value="HIGH">높음</option><option value="MEDIUM">보통</option><option value="LOW">낮음</option>
          </select>
          <button type="button" className="btn-secondary text-xs" aria-pressed={sortPriority} onClick={() => setSortPriority((value) => !value)}>우선순위 순</button>
          <button type="button" className="btn-secondary text-xs" aria-pressed={groupByMilestone} onClick={() => setGroupByMilestone((value) => !value)}
            title="각 열의 카드를 마일스톤별로 묶어 봅니다 (이 상태에서는 카드 순서 변경이 꺼집니다)">마일스톤별 묶기</button>
          <button type="button" className="btn-secondary text-xs" aria-pressed={compact} onClick={toggleCompact}
            title="카드를 한 줄로 줄여 더 많이 봅니다">{compact ? "자세히 보기" : "간단히 보기"}</button>
            </div>
          </details>
          <span className="shrink-0 text-xs text-ui-muted" aria-live="polite">{visibleTodos.length}개</span>
        </div>
        {!project.archived ? <button type="button" className="btn-primary shrink-0" onClick={() => setShowAdd((value) => !value)}>
          <Plus size={16} />{showAdd ? "추가 닫기" : "작업 추가"}
        </button> : null}
      </div>
      {showAdd && !project.archived ? <TodoForm compact autoFocus submitLabel="추가" defaultProjectId={project.id}
        categories={categories} projects={projects} onAdd={onAddTodo} /> : null}

      <DndContext sensors={sensors} collisionDetection={columnCollision} onDragStart={onDragStart} onDragCancel={onDragCancel} onDragEnd={handleDragEnd}>
        <div className="project-v4-board-viewport">
          <div data-done-collapsed={collapsedDoneColumns[project.id] ?? false} data-density={compact ? "compact" : "comfortable"} className="project-v4-board grid grid-cols-4 gap-3">
            {workflowColumns.map((column) => {
              const items = visibleByStatus.get(column.status) ?? [];
              // WIP count is the total project count, not the filtered subset.
              const count = indexed.byStatus.get(column.status)?.length ?? 0;
              return (
                <KanbanColumn key={column.status} status={column.status} label={column.label} count={count} visibleCount={items.length} wipLimit={wipLimitsByProject[project.id]?.[column.status]} onWipLimitChange={changeWipLimit} collapsed={column.status === "DONE" && (collapsedDoneColumns[project.id] ?? false)} onToggleCollapse={column.status === "DONE" ? () => setCollapsedDoneColumns((current) => ({ ...current, [project.id]: toggleDoneColumnCollapsed(current[project.id]) })) : undefined}>
                  {(groupByMilestone ? groupByMilestoneOrder(items, milestones) : [{ key: "all", title: "", items }]).map((group) => (
                    <div key={group.key} className="project-kanban-group">
                      {group.title ? <h5 className="project-kanban-group__title">{group.title}<span>{group.items.length}</span></h5> : null}
                      {group.items.map((todo) => (
                        <ProjectKanbanCard
                          key={todo.id}
                          project={project}
                          todo={todo}
                          parent={todo.parentTodoId ? indexed.todoById.get(todo.parentTodoId) : undefined}
                          childCount={indexed.childCountByParentId.get(todo.id) || 0}
                          milestone={todo.milestoneId ? indexed.milestoneById.get(todo.milestoneId) : undefined}
                          today={today}
                          canReposition={!sortPriority && !groupByMilestone}
                          onReposition={stableReposition}
                          onToggleTodo={stableToggle}
                          onOpenDetails={openDetails}
                          onMove={moveTodo}
                          onDetach={openDetach}
                          onDelete={onDeleteTodo}
                        />
                      ))}
                    </div>
                  ))}
                  {!project.archived ? addingTo === column.status ? (
                    <TodoForm compact autoFocus layout="stacked" defaultProjectId={project.id} categories={categories}
                      projects={projects} onCancel={() => setAddingTo(null)}
                      onAdd={(input) => onAddTodo({ ...input, projectId: project.id, workflowStatus: column.status })} />
                  ) : <button type="button" className="project-kanban-add btn-secondary w-full text-xs" onClick={() => setAddingTo(column.status)}>+ 작업 추가</button> : null}
                  {!items.length ? <p className="project-kanban-empty text-xs text-ui-muted">여기로 작업을 이동할 수 있습니다</p> : null}
                </KanbanColumn>
              );
            })}
          </div>
        </div>
        <DragOverlay adjustScale={false} dropAnimation={null} zIndex={70}>
          {activeDragTodo ? <div className="project-v4-drag-preview" role="presentation" aria-hidden="true">
            <span className="project-v4-drag-preview__grip"><GripVertical size={15} /></span>
            <span className="truncate">{activeDragTodo.title}</span>
          </div> : null}
        </DragOverlay>
      </DndContext>
      {detachTarget ? <Modal title="프로젝트에서 제외" onClose={() => { if (!detaching) setDetachTarget(null); }}>
        <p className="text-sm text-ui-secondary">“{detachTarget.title}”의 프로젝트 연결을 해제합니다. Task와 일정은 유지됩니다.</p>
        {detachFailed ? <p role="alert" className="mt-2 text-sm text-danger">작업을 제외하지 못했습니다. 연결을 확인하고 다시 시도하세요.</p> : null}
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <button type="button" className="btn-secondary" disabled={detaching} onClick={() => setDetachTarget(null)}>취소</button>
          {indexed.childCountByParentId.has(detachTarget.id) ? <button type="button" className="btn-secondary" disabled={detaching} onClick={() => void detach(true)}>하위 작업과 함께 제외</button> : null}
          <button type="button" className="btn-primary" disabled={detaching} onClick={() => void detach(false)}>{detaching ? "처리 중" : "이 작업만 제외"}</button>
        </div>
      </Modal> : null}
      {editingTodo ? <TodoEditModal todo={editingTodo} categories={categories} projects={projects}
        milestones={milestones} subtasks={todos.filter((item) => item.parentTodoId === editingTodo.id)}
        onAddSubtask={async (parent, title) => {
          const scheduled = parent.planningState === "SCHEDULED";
          return onAddTodo({
            title, projectId: project.id, milestoneId: parent.milestoneId, parentTodoId: parent.id,
            date: scheduled ? parent.date : today, planningState: scheduled ? "SCHEDULED" : "INBOX",
            priority: parent.priority,
          });
        }}
        onClose={() => setEditingTodoId(null)} onSave={onUpdateTodo} presentation="side-panel" /> : null}
    </section>
  );
}
