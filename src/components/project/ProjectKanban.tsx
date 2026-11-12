import { DndContext, DragOverlay, PointerSensor, pointerWithin, rectIntersection, useDraggable, useDroppable, useSensor, useSensors, type CollisionDetection, type DragEndEvent, type DragStartEvent } from "@dnd-kit/core";
import { ChevronDown, ChevronRight, GripVertical, MoreHorizontal, Plus, Search } from "lucide-react";
import { memo, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { TodoForm } from "../todo/TodoForm";
import { exceedsWipLimit } from "../../lib/projectWorkflow";
import { formatKoreanDate, todayKey } from "../../lib/date";
import { isDueSoon, isOverdueByDeadline } from "../../lib/todo";
import { workflowStatusLabels } from "../../lib/todoLabels";
import type { Category } from "../../types/category";
import type { Milestone, Project } from "../../types/project";
import type { Todo, TodoInput, TodoWorkflowStatus } from "../../types/todo";
import { Modal } from "../common/Modal";
import { TodoEditModal } from "../todo/TodoEditModal";

const workflowColumns: Array<{ status: TodoWorkflowStatus; label: string }> = [
  { status: "TODO", label: workflowStatusLabels.TODO },
  { status: "IN_PROGRESS", label: "진행 중" },
  { status: "BLOCKED", label: workflowStatusLabels.BLOCKED },
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
};

const statusOf = (todo: Todo): TodoWorkflowStatus => todo.workflowStatus || (todo.completed ? "DONE" : "TODO");

// Pointer location, rather than the nearest column's center, decides the drop.
// Rect intersection is the fallback for keyboard/synthetic drag interactions.
const columnCollision: CollisionDetection = (args) => {
  const pointer = pointerWithin(args);
  return pointer.length ? pointer : rectIntersection(args);
};
const WIP_LIMITS_KEY = "dark-todo-planner:project-wip-limits";
const DONE_COLUMN_KEY = "dark-todo-planner:collapsed-done-columns";
type WipLimits = Partial<Record<TodoWorkflowStatus, number>>;
type ProjectWipLimits = Record<string, WipLimits>;

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
      className="project-kanban-column min-h-[10rem] w-[17rem] shrink-0 px-3 py-3 transition sm:w-auto">
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
      </p> : <div className="space-y-2">{children}</div>}
    </section>
  );
}

const ProjectKanbanCard = memo(function ProjectKanbanCard({ project, todo, parent, childCount, milestone, today, onToggleTodo, onOpenDetails, onMove, onDetach, onDelete }: {
  project: Project;
  todo: Todo;
  parent?: Todo;
  childCount: number;
  milestone?: Milestone;
  today: string;
  onToggleTodo: ProjectKanbanProps["onToggleTodo"];
  onOpenDetails: (todo: Todo) => void;
  onMove: (todo: Todo, status: TodoWorkflowStatus) => void;
  onDetach: (todo: Todo) => void;
  onDelete: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: todo.id, disabled: project.archived,
  });
  const overdue = isOverdueByDeadline(todo, today);
  const dueSoon = isDueSoon(todo, today);
  const status = statusOf(todo);
  return (
    <article ref={setNodeRef} data-v4-card="true"
      data-dragging={isDragging ? "true" : "false"} className="project-kanban-card">
      <div className="project-v4-card__top">
        <button type="button" disabled={project.archived} onClick={() => onToggleTodo(todo.id)}
          className="project-v4-card__check" aria-label={`${todo.title} 완료 토글`}>
          <span className={`block h-4 w-4 rounded-full border ${todo.completed ? "border-success bg-success" : "border-ink-600"}`} aria-hidden="true" />
        </button>
        <div className="min-w-0 flex-1">
          {parent ? <span className="project-v4-card__parent">↳ {parent.title}</span> : null}
          <button type="button" className={`project-v4-card__title ${todo.completed ? "line-through opacity-60" : ""}`}
            onClick={() => onOpenDetails(todo)}>{todo.title}</button>
        </div>
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

export function ProjectKanban({ project, todos, milestones, categories = [], projects = [], onAddTodo, onUpdateTodo, onToggleTodo, onDeleteTodo, onDetachTodo }: ProjectKanbanProps) {
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
  const moveTodo = (todo: Todo, workflowStatus: TodoWorkflowStatus) => {
    void onUpdateTodo(todo.id, { workflowStatus, completed: workflowStatus === "DONE" });
  };
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
  const [wipLimitsByProject, setWipLimitsByProject] = useState<ProjectWipLimits>(readWipLimits);
  const [collapsedDoneColumns, setCollapsedDoneColumns] = useState<Record<string, boolean>>(readCollapsedDoneColumns);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  useEffect(() => {
    try { localStorage.setItem(WIP_LIMITS_KEY, JSON.stringify(wipLimitsByProject)); } catch { /* WIP guidance remains usable for the current session. */ }
  }, [wipLimitsByProject]);

  useEffect(() => {
    try { localStorage.setItem(DONE_COLUMN_KEY, JSON.stringify(collapsedDoneColumns)); } catch { /* Keep the board usable when browser storage is unavailable. */ }
  }, [collapsedDoneColumns]);

  const changeWipLimit = (status: TodoWorkflowStatus, value: number) => {
    setWipLimitsByProject((current) => {
      const projectLimits = { ...current[project.id] };
      if (value === 0) delete projectLimits[status];
      else projectLimits[status] = value;
      return { ...current, [project.id]: projectLimits };
    });
  };

  const visibleTodos = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    const filtered = todos.filter((todo) => {
      const matchesQuery = !normalizedQuery || `${todo.title} ${todo.memo || ""}`.toLocaleLowerCase().includes(normalizedQuery);
      return matchesQuery && (priorityFilter === "ALL" || todo.priority === priorityFilter);
    });
    const priorityRank = { HIGH: 0, MEDIUM: 1, LOW: 2 };
    return sortPriority ? filtered.sort((a, b) => priorityRank[a.priority] - priorityRank[b.priority] || a.createdAt.localeCompare(b.createdAt)) : filtered;
  }, [priorityFilter, query, sortPriority, todos]);

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

  const onDragStart = useCallback(({ active }: DragStartEvent) => {
    setActiveDragId(String(active.id));
  }, []);
  const onDragCancel = useCallback(() => setActiveDragId(null), []);

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    setActiveDragId(null);
    const overId = over?.id;
    if (typeof overId !== "string" || !overId.startsWith("column:")) return;
    const nextStatus = overId.slice("column:".length) as TodoWorkflowStatus;
    if (!workflowColumns.some((column) => column.status === nextStatus)) return;
    const todo = indexed.todoById.get(String(active.id));
    if (!todo || project.archived || statusOf(todo) === nextStatus) return;
    moveTodo(todo, nextStatus);
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
          <select className="field h-9 min-h-9 w-auto text-xs" value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value)} aria-label="우선순위 필터">
            <option value="ALL">모든 우선순위</option><option value="HIGH">높음</option><option value="MEDIUM">보통</option><option value="LOW">낮음</option>
          </select>
          <button type="button" className="btn-secondary text-xs" aria-pressed={sortPriority} onClick={() => setSortPriority((value) => !value)}>우선순위 순</button>
          <span className="shrink-0 text-xs text-ui-muted" aria-live="polite">{visibleTodos.length}개</span>
        </div>
        {!project.archived ? <button type="button" className="btn-primary shrink-0" onClick={() => setShowAdd((value) => !value)}>
          <Plus size={16} />{showAdd ? "추가 닫기" : "작업 추가"}
        </button> : null}
      </div>
      {showAdd && !project.archived ? <TodoForm compact autoFocus submitLabel="추가" defaultProjectId={project.id}
        categories={categories} projects={projects} onAdd={onAddTodo} /> : null}

      <DndContext sensors={sensors} collisionDetection={columnCollision} onDragStart={onDragStart} onDragCancel={onDragCancel} onDragEnd={handleDragEnd}>
        <div className="overflow-x-auto pb-2">
          <div data-done-collapsed={collapsedDoneColumns[project.id] ?? true} className="project-v4-board grid min-w-[68rem] grid-cols-4 gap-3">
            {workflowColumns.map((column) => {
              const items = visibleByStatus.get(column.status) ?? [];
              // WIP count is the total project count, not the filtered subset.
              const count = indexed.byStatus.get(column.status)?.length ?? 0;
              return (
                <KanbanColumn key={column.status} status={column.status} label={column.label} count={count} visibleCount={items.length} wipLimit={wipLimitsByProject[project.id]?.[column.status]} onWipLimitChange={changeWipLimit} collapsed={column.status === "DONE" && (collapsedDoneColumns[project.id] ?? true)} onToggleCollapse={column.status === "DONE" ? () => setCollapsedDoneColumns((current) => ({ ...current, [project.id]: !(current[project.id] ?? true) })) : undefined}>
                  {items.map((todo) => (
                    <ProjectKanbanCard
                      key={todo.id}
                      project={project}
                      todo={todo}
                      parent={todo.parentTodoId ? indexed.todoById.get(todo.parentTodoId) : undefined}
                      childCount={indexed.childCountByParentId.get(todo.id) || 0}
                      milestone={todo.milestoneId ? indexed.milestoneById.get(todo.milestoneId) : undefined}
                      today={today}
                      onToggleTodo={stableToggle}
                      onOpenDetails={openDetails}
                      onMove={moveTodo}
                      onDetach={openDetach}
                      onDelete={onDeleteTodo}
                    />
                  ))}
                  {!project.archived ? addingTo === column.status ? (
                    <TodoForm compact autoFocus layout="stacked" defaultProjectId={project.id} categories={categories}
                      projects={projects} onCancel={() => setAddingTo(null)}
                      onAdd={(input) => onAddTodo({ ...input, projectId: project.id, workflowStatus: column.status })} />
                  ) : <button type="button" className="btn-secondary w-full text-xs" onClick={() => setAddingTo(column.status)}>+ 추가</button> : null}
                  {!items.length ? <p className="border-t border-ui-divider py-6 text-center text-xs text-ui-muted">여기로 작업을 이동할 수 있습니다</p> : null}
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
