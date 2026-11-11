import { DndContext, DragOverlay, PointerSensor, pointerWithin, rectIntersection, useDraggable, useDroppable, useSensor, useSensors, type CollisionDetection, type DragEndEvent, type DragStartEvent } from "@dnd-kit/core";
import { ChevronDown, ChevronRight, GripVertical, LayoutGrid, List, Pencil, Search } from "lucide-react";
import { memo, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { todayKey } from "../../lib/date";
import { isDueSoon, isOverdueByDeadline } from "../../lib/todo";
import { workflowStatusLabels } from "../../lib/todoLabels";
import type { Category } from "../../types/category";
import type { Milestone, Project } from "../../types/project";
import type { Todo, TodoInput, TodoWorkflowStatus } from "../../types/todo";
import { TodoRow } from "../todo/TodoRow";
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
};

const statusOf = (todo: Todo): TodoWorkflowStatus => todo.workflowStatus || (todo.completed ? "DONE" : "TODO");

// Pointer location, rather than the nearest column's center, decides the drop.
// Rect intersection is the fallback for keyboard/synthetic drag interactions.
const columnCollision: CollisionDetection = (args) => {
  const pointer = pointerWithin(args);
  return pointer.length ? pointer : rectIntersection(args);
};
const VIEW_MODE_KEY = "dark-todo-planner:project-work-view";
const WIP_LIMITS_KEY = "dark-todo-planner:project-wip-limits";
const DONE_COLUMN_KEY = "dark-todo-planner:collapsed-done-columns";
type WipLimits = Partial<Record<TodoWorkflowStatus, number>>;
type ProjectWipLimits = Record<string, WipLimits>;

const readInitialViewMode = (): "board" | "list" => {
  try {
    return localStorage.getItem(VIEW_MODE_KEY) === "list" ? "list" : "board";
  } catch {
    return "board";
  }
};

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
  const overLimit = wipLimit !== undefined && count > wipLimit;
  return (
    <section ref={setNodeRef} data-status={status} data-drag-over={isOver ? "true" : "false"}
      className="project-kanban-column min-h-[10rem] w-[17rem] shrink-0 px-3 py-3 transition sm:w-auto">
      <div className="project-kanban-column__header">
        <div className="project-kanban-column__identity">
          {onToggleCollapse ? <button type="button" className="inline-flex min-h-9 items-center gap-1 rounded-[4px] px-1 text-sm font-semibold text-ink-100 hover:bg-ink-850 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/70"
            onClick={onToggleCollapse} aria-expanded={!collapsed}>
            {collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}{label}
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
      {overLimit ? <p className="mb-2 border-l-2 border-danger/65 py-1 pl-2 text-[11px] font-medium text-danger" role="status">
        WIP 한도 초과 · 작업을 먼저 마무리해 보세요.
      </p> : null}
      {collapsed ? <p className="border-t border-ink-700/35 px-2 py-5 text-center text-xs text-ink-500">
        완료 작업 {count}개 · 열을 펼쳐 확인하세요
      </p> : <div className="space-y-2">{children}</div>}
    </section>
  );
}

const ProjectKanbanCard = memo(function ProjectKanbanCard({ project, todo, parent, childCount, milestone, today, onToggleTodo, onOpenDetails }: {
  project: Project;
  todo: Todo;
  parent?: Todo;
  childCount: number;
  milestone?: Milestone;
  today: string;
  onToggleTodo: ProjectKanbanProps["onToggleTodo"];
  onOpenDetails: (todo: Todo) => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: todo.id, disabled: project.archived,
  });
  const overdue = isOverdueByDeadline(todo, today);
  const dueSoon = isDueSoon(todo, today);
  return (
    <article ref={setNodeRef} data-v4-card="true"
      data-dragging={isDragging ? "true" : "false"} className="project-kanban-card">
      <div className="project-v4-card__top">
        <button type="button" onClick={() => onToggleTodo(todo.id)}
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
      </div>
      {(todo.priority === "HIGH" || milestone || childCount > 0 || todo.dueDate) ? (
        <div className="project-v4-card__meta">
          {todo.priority === "HIGH" ? <span className="text-warning">높음</span> : null}
          {milestone ? <span title={milestone.title} className="truncate">{milestone.title}</span> : null}
          {childCount ? <span>하위 {childCount}</span> : null}
          {todo.dueDate ? <span className={overdue ? "text-danger" : dueSoon ? "text-warning" : ""}>마감 {todo.dueDate}</span> : null}
        </div>
      ) : null}
    </article>
  );
});

export function ProjectKanban({ project, todos, milestones, categories = [], projects = [], onAddTodo, onUpdateTodo, onToggleTodo, onDeleteTodo }: ProjectKanbanProps) {
  const today = todayKey();
  const [viewMode, setViewMode] = useState<"board" | "list">(readInitialViewMode);
  const [query, setQuery] = useState("");
  const [milestoneFilter, setMilestoneFilter] = useState("");
  const [editingTodo, setEditingTodo] = useState<Todo | null>(null);
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
    try { localStorage.setItem(VIEW_MODE_KEY, viewMode); } catch { /* The view remains usable without browser storage. */ }
  }, [viewMode]);

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
    return todos.filter((todo) => {
      const matchesQuery = !normalizedQuery || `${todo.title} ${todo.memo || ""}`.toLocaleLowerCase().includes(normalizedQuery);
      const matchesMilestone = !milestoneFilter || (milestoneFilter === "unassigned" ? !todo.milestoneId : todo.milestoneId === milestoneFilter);
      return matchesQuery && matchesMilestone;
    });
  }, [milestoneFilter, query, todos]);

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
    void onUpdateTodo(todo.id, { workflowStatus: nextStatus, completed: nextStatus === "DONE" });
  };
  const activeDragTodo = activeDragId ? indexed.todoById.get(activeDragId) : undefined;

  return (
    <section className="space-y-3">
      <div className="flex flex-col gap-3 border-b border-ui-divider pb-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h3 className="text-base font-bold text-ink-100">프로젝트 작업</h3>
          <p className="mt-1 text-xs text-ink-400">{viewMode === "board" ? "카드의 핸들을 드래그해 상태를 바꾸고 제목을 눌러 상세 정보를 수정합니다." : "상태를 바로 변경하거나 행을 열어 세부 내용을 수정합니다."}</p>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 lg:w-auto lg:justify-end">
          <label className="relative w-full sm:w-60">
            <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-500" />
            <input className="field h-9 min-h-9 pl-8 py-1 text-xs" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="프로젝트 작업 검색" aria-label="프로젝트 작업 검색" />
          </label>
          <select className="field h-9 min-h-9 w-full py-1 text-xs sm:w-48" value={milestoneFilter} onChange={(event) => setMilestoneFilter(event.target.value)} aria-label="마일스톤 필터">
            <option value="">모든 마일스톤</option><option value="unassigned">미지정</option>{milestones.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
          </select>
          <div className="inline-flex shrink-0 border-b border-ui-divider" role="group" aria-label="프로젝트 작업 보기">
            <button type="button" className={`inline-flex h-8 items-center gap-1.5 rounded px-2 text-xs font-semibold ${viewMode === "board" ? "border-b border-ui-focus text-ui-text" : "text-ui-secondary hover:text-ui-text"}`} aria-pressed={viewMode === "board"} onClick={() => setViewMode("board")}><LayoutGrid size={14} />보드</button>
            <button type="button" className={`inline-flex h-8 items-center gap-1.5 rounded px-2 text-xs font-semibold ${viewMode === "list" ? "border-b border-ui-focus text-ui-text" : "text-ui-secondary hover:text-ui-text"}`} aria-pressed={viewMode === "list"} onClick={() => setViewMode("list")}><List size={14} />목록</button>
          </div>
          <span className="shrink-0 text-xs text-ui-muted" aria-live="polite">{visibleTodos.length}개</span>
        </div>
      </div>

      {!visibleTodos.length ? (
        <div className="border-b border-ui-divider py-10" role="status">
          <h4 className="text-sm font-semibold text-ui-text">{todos.length ? "검색 조건에 맞는 작업이 없습니다." : "아직 등록한 프로젝트 작업이 없습니다."}</h4>
          <p className="mt-1.5 text-sm text-ui-secondary">{todos.length ? "검색어 또는 마일스톤 필터를 변경해 보세요." : "위의 Todo 빠른 추가에서 첫 작업을 등록하세요."}</p>
        </div>
      ) : viewMode === "board" ? <DndContext sensors={sensors} collisionDetection={columnCollision} onDragStart={onDragStart} onDragCancel={onDragCancel} onDragEnd={handleDragEnd}>
        <div className="overflow-x-auto pb-2">
          <div className="project-v4-board grid min-w-[68rem] grid-cols-4 gap-3">
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
                      onOpenDetails={setEditingTodo}
                    />
                  ))}
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
      </DndContext> : (
        <div className="overflow-x-auto border-t border-ink-700/50">
          <table className="w-full min-w-[58rem] text-left text-sm">
            <thead className="border-b border-ink-700/65 bg-ink-900/80 text-xs text-ink-400">
              <tr><th scope="col" className="px-3 py-2.5">작업</th><th scope="col" className="px-3 py-2.5">상태</th><th scope="col" className="px-3 py-2.5">우선순위</th><th scope="col" className="px-3 py-2.5">마일스톤</th><th scope="col" className="px-3 py-2.5">작업일</th><th scope="col" className="px-3 py-2.5">마감일</th><th scope="col" className="w-12 px-3 py-2.5"><span className="sr-only">작업 편집</span></th></tr>
            </thead>
            <tbody className="divide-y divide-ink-800/70">
              {visibleTodos.map((todo) => (
                <tr key={todo.id} className="hover:bg-ink-800/40">
                  <td className="max-w-[30rem] px-3 py-2.5">
                    <TodoRow todo={todo} onToggle={onToggleTodo} onDelete={onDeleteTodo} onEdit={setEditingTodo}
                      showDate={false} showCategoryBadge={false} hideMediumPriority />
                    {todo.parentTodoId && indexed.todoById.get(todo.parentTodoId) ? <p className="ml-6 mt-1 truncate text-[11px] text-ink-400">상위 작업: {indexed.todoById.get(todo.parentTodoId)?.title}</p> : null}
                  </td>
                  <td className="px-3 py-2.5"><select className="field h-8 min-h-8 w-28 py-0.5 text-xs" value={statusOf(todo)} onChange={(event) => { const nextStatus = event.target.value as TodoWorkflowStatus; void onUpdateTodo(todo.id, { workflowStatus: nextStatus, completed: nextStatus === "DONE" }); }} disabled={project.archived} aria-label={`${todo.title} 상태`}>{(["TODO", "IN_PROGRESS", "BLOCKED", "DONE"] as const).map((status) => <option key={status} value={status}>{workflowStatusLabels[status]}</option>)}</select></td>
                  <td className="px-3 py-2.5 text-xs text-ink-300">{todo.priority === "HIGH" ? "높음" : todo.priority === "LOW" ? "낮음" : "보통"}</td>
                  <td className="px-3 py-2.5"><select className="field h-8 min-h-8 max-w-44 py-0.5 text-xs" value={todo.milestoneId || ""} onChange={(event) => void onUpdateTodo(todo.id, { projectId: project.id, milestoneId: event.target.value || undefined })} disabled={project.archived} aria-label={`${todo.title} 마일스톤`}><option value="">미지정</option>{milestones.map((milestone) => <option key={milestone.id} value={milestone.id}>{milestone.title}</option>)}</select></td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-xs text-ink-300">{todo.date === "9999-12-31" ? "—" : todo.date}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-xs">{todo.dueDate ? <span className={isOverdueByDeadline(todo, today) ? "text-danger" : isDueSoon(todo, today) ? "text-warning" : "text-ink-300"}>{todo.dueDate}</span> : <span className="text-ink-600">—</span>}</td>
                  <td className="px-3 py-2.5"><button type="button" className="icon-btn h-8 w-8" onClick={() => setEditingTodo(todo)} aria-label={`${todo.title} 편집`}><Pencil size={14} /></button></td>
                </tr>
              ))}
              {!visibleTodos.length ? <tr><td colSpan={7} className="px-3 py-12 text-center text-sm text-ink-400">검색 조건에 맞는 프로젝트 작업이 없습니다.</td></tr> : null}
            </tbody>
          </table>
        </div>
      )}
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
        onClose={() => setEditingTodo(null)} onSave={onUpdateTodo} presentation="side-panel" /> : null}
    </section>
  );
}
