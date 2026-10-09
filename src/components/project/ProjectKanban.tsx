import { DndContext, PointerSensor, closestCenter, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { ChevronDown, ChevronRight, GripVertical, LayoutGrid, List, Pencil, Plus, Search } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { todayKey } from "../../lib/date";
import { isDueSoon, isOverdueByDeadline } from "../../lib/todo";
import { workflowStatusClassNames, workflowStatusLabels } from "../../lib/todoLabels";
import type { Category } from "../../types/category";
import type { Milestone, Project } from "../../types/project";
import type { Todo, TodoInput, TodoWorkflowStatus } from "../../types/todo";
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
};

const statusOf = (todo: Todo): TodoWorkflowStatus => todo.workflowStatus || (todo.completed ? "DONE" : "TODO");
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

function KanbanColumn({ status, label, count, wipLimit, onWipLimitChange, collapsed = false, onToggleCollapse, children }: { status: TodoWorkflowStatus; label: string; count: number; wipLimit?: number; onWipLimitChange: (status: TodoWorkflowStatus, limit: number) => void; collapsed?: boolean; onToggleCollapse?: () => void; children: ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: `column:${status}` });
  const overLimit = wipLimit !== undefined && count > wipLimit;
  return (
    <section ref={setNodeRef} className={`app-card min-h-[18rem] w-[17rem] shrink-0 p-3 transition sm:w-auto ${isOver ? "border-accent-500/55 bg-accent-500/[0.05]" : ""}`}>
      <div className="mb-3 flex items-center justify-between gap-2">
        {onToggleCollapse ? <button type="button" className={`inline-flex min-h-8 items-center gap-1 rounded-md border px-2 text-sm font-bold ${workflowStatusClassNames[status]}`} onClick={onToggleCollapse} aria-expanded={!collapsed}>{collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}{label}</button> : <h4 className={`rounded-md border px-2 py-1 text-sm font-bold ${workflowStatusClassNames[status]}`}>{label}</h4>}
        <div className="flex items-center gap-1.5">
          <label className="flex items-center gap-1 text-[10px] text-ink-500" title="0으로 설정하면 작업 수 제한이 없습니다.">
            <span>WIP</span>
            <input type="number" min={0} max={999} className="field h-7 min-h-7 w-12 px-1 py-0.5 text-center text-[11px]" value={wipLimit || ""} placeholder="—" aria-label={`${label} WIP 한도`} onChange={(event) => onWipLimitChange(status, Math.max(0, Math.min(999, Number.parseInt(event.target.value, 10) || 0)))} />
          </label>
          <span className={`rounded-full border px-2 py-0.5 text-xs ${overLimit ? "border-danger/45 bg-danger/10 font-bold text-red-200" : "border-ink-800/70 bg-ink-950/45 text-ink-400"}`}>{count}{wipLimit !== undefined ? `/${wipLimit}` : ""}</span>
        </div>
      </div>
      {overLimit ? <p className="mb-2 rounded-md border border-danger/25 bg-danger/[0.06] px-2 py-1 text-[11px] font-semibold text-red-200" role="status">WIP 한도 초과 · 작업을 먼저 마무리해 보세요.</p> : null}
      {collapsed ? <p className="rounded-lg border border-dashed border-ink-800/75 px-2 py-5 text-center text-xs text-ink-500">완료 작업 {count}개 · 열을 펼쳐 확인하세요</p> : <div className="space-y-2">{children}</div>}
    </section>
  );
}

function ProjectKanbanCard({ project, todo, parent, childCount, milestone, milestones, today, onAddTodo, onUpdateTodo, onToggleTodo, onOpenDetails }: {
  project: Project;
  todo: Todo;
  parent?: Todo;
  childCount: number;
  milestone?: Milestone;
  milestones: Milestone[];
  today: string;
  onAddTodo: ProjectKanbanProps["onAddTodo"];
  onUpdateTodo: ProjectKanbanProps["onUpdateTodo"];
  onToggleTodo: ProjectKanbanProps["onToggleTodo"];
  onOpenDetails: (todo: Todo) => void;
}) {
  const [showSubtask, setShowSubtask] = useState(false);
  const [subtaskTitle, setSubtaskTitle] = useState("");
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: todo.id, disabled: project.archived });
  const overdue = isOverdueByDeadline(todo, today);
  const dueSoon = isDueSoon(todo, today);

  const createSubtask = async () => {
    const title = subtaskTitle.trim();
    if (!title) return;
    const scheduled = todo.planningState === "SCHEDULED";
    const created = await onAddTodo({
      title,
      projectId: project.id,
      milestoneId: todo.milestoneId,
      parentTodoId: todo.id,
      date: scheduled ? todo.date : today,
      planningState: scheduled ? "SCHEDULED" : "INBOX",
      priority: todo.priority,
    });
    if (!created) return;
    setShowSubtask(false);
    setSubtaskTitle("");
  };

  return (
    <article ref={setNodeRef} style={{ transform: CSS.Translate.toString(transform), opacity: isDragging ? 0.55 : 1 }} className="rounded-lg border border-ink-700/60 bg-ink-850 p-3 shadow-sm transition hover:border-ink-600">
      <div className="flex items-start gap-2">
        <button type="button" onClick={() => onToggleTodo(todo.id)} className={`mt-0.5 h-4 w-4 shrink-0 rounded-full border ${todo.completed ? "border-success bg-success" : "border-ink-600"}`} aria-label="완료 토글" />
        <div className="min-w-0 flex-1">
          {parent ? <p className="mb-1 truncate text-[10px] font-semibold text-accent-300">↳ {parent.title}</p> : null}
          <button type="button" className={`block break-words text-left text-sm font-semibold hover:text-accent-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/50 ${todo.completed ? "text-ink-500 line-through" : "text-ink-100"}`} onClick={() => onOpenDetails(todo)}>{todo.title}</button>
          <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] text-ink-400">
            <span className="rounded border border-ink-800/70 bg-ink-900/60 px-1.5 py-0.5">우선순위 {todo.priority === "HIGH" ? "높음" : todo.priority === "LOW" ? "낮음" : "보통"}</span>
            {milestone ? <span className="rounded border border-accent-500/25 bg-accent-500/[0.06] px-1.5 py-0.5 text-accent-200">{milestone.title}</span> : null}
            {childCount ? <span className="rounded border border-accent-500/25 bg-accent-500/[0.06] px-1.5 py-0.5 text-accent-200">하위 {childCount}</span> : null}
            {todo.dueDate ? <span className={`rounded border px-1.5 py-0.5 ${overdue ? "border-danger/30 bg-danger/[0.07] text-red-100" : dueSoon ? "border-warning/30 bg-warning/[0.07] text-amber-100" : "border-ink-800/70 bg-ink-900/60"}`}>마감 {todo.dueDate}</span> : null}
          </div>
        </div>
        {!project.archived ? (
          <button type="button" className="icon-btn h-8 w-8 shrink-0 cursor-grab active:cursor-grabbing" title="드래그하여 상태 변경" aria-label={`${todo.title} 상태 이동`} {...listeners} {...attributes}>
            <GripVertical size={15} />
          </button>
        ) : null}
      </div>

      <div className="mt-2">
        <select className="field min-h-9 py-1 text-xs" value={todo.milestoneId || ""} onChange={(event) => void onUpdateTodo(todo.id, { projectId: project.id, milestoneId: event.target.value || undefined })} disabled={project.archived} aria-label={`${todo.title} 마일스톤`}>
          <option value="">마일스톤 없음</option>
          {milestones.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
        </select>
      </div>

      {!project.archived ? (
        <button type="button" className="mt-2 text-[11px] font-semibold text-ink-500 hover:text-accent-200" onClick={() => { setShowSubtask((current) => !current); setSubtaskTitle(""); }}>
          <Plus size={12} className="mr-1 inline" />하위 Todo
        </button>
      ) : null}

      {showSubtask ? (
        <div className="mt-2 flex gap-1.5">
          <input className="field min-h-9 py-1 text-xs" value={subtaskTitle} onChange={(event) => setSubtaskTitle(event.target.value)} placeholder="하위 작업" onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void createSubtask(); } }} />
          <button type="button" className="btn-secondary min-h-9 px-2 py-1 text-xs" onClick={() => void createSubtask()} disabled={!subtaskTitle.trim()}>추가</button>
        </div>
      ) : null}
    </article>
  );
}

export function ProjectKanban({ project, todos, milestones, categories = [], projects = [], onAddTodo, onUpdateTodo, onToggleTodo }: ProjectKanbanProps) {
  const today = todayKey();
  const [viewMode, setViewMode] = useState<"board" | "list">(readInitialViewMode);
  const [query, setQuery] = useState("");
  const [milestoneFilter, setMilestoneFilter] = useState("");
  const [editingTodo, setEditingTodo] = useState<Todo | null>(null);
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

  const handleDragEnd = (event: DragEndEvent) => {
    const overId = event.over?.id;
    if (!overId || typeof overId !== "string" || !overId.startsWith("column:")) return;
    const todo = indexed.todoById.get(String(event.active.id));
    if (!todo || project.archived) return;
    const nextStatus = overId.slice("column:".length) as TodoWorkflowStatus;
    if (statusOf(todo) === nextStatus) return;
    void onUpdateTodo(todo.id, { workflowStatus: nextStatus, completed: nextStatus === "DONE" });
  };

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-ink-100">프로젝트 작업</h3>
          <p className="mt-1 text-xs text-ink-400">{viewMode === "board" ? "카드의 핸들을 드래그해 상태를 바꾸고 제목을 눌러 상세 정보를 수정합니다." : "상태를 바로 변경하거나 행을 열어 세부 내용을 수정합니다."}</p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <label className="relative min-w-48 flex-1 sm:flex-none">
            <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-500" />
            <input className="field h-9 min-h-9 pl-8 py-1 text-xs" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="프로젝트 작업 검색" aria-label="프로젝트 작업 검색" />
          </label>
          <select className="field h-9 min-h-9 w-auto min-w-36 py-1 text-xs" value={milestoneFilter} onChange={(event) => setMilestoneFilter(event.target.value)} aria-label="마일스톤 필터">
            <option value="">모든 마일스톤</option><option value="unassigned">미지정</option>{milestones.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
          </select>
          <div className="inline-flex rounded-md border border-ink-700/75 bg-ink-950/45 p-0.5" role="group" aria-label="프로젝트 작업 보기">
            <button type="button" className={`inline-flex h-8 items-center gap-1.5 rounded px-2 text-xs font-semibold ${viewMode === "board" ? "bg-ink-700 text-ink-100" : "text-ink-400 hover:text-ink-100"}`} aria-pressed={viewMode === "board"} onClick={() => setViewMode("board")}><LayoutGrid size={14} />보드</button>
            <button type="button" className={`inline-flex h-8 items-center gap-1.5 rounded px-2 text-xs font-semibold ${viewMode === "list" ? "bg-ink-700 text-ink-100" : "text-ink-400 hover:text-ink-100"}`} aria-pressed={viewMode === "list"} onClick={() => setViewMode("list")}><List size={14} />목록</button>
          </div>
          <span className="text-xs text-ink-400" aria-live="polite">{visibleTodos.length}개</span>
        </div>
      </div>

      {viewMode === "board" ? <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <div className="overflow-x-auto pb-2">
          <div className="grid min-w-[68rem] grid-cols-4 gap-3">
            {workflowColumns.map((column) => {
              const items = visibleTodos.filter((todo) => statusOf(todo) === column.status);
              return (
                <KanbanColumn key={column.status} status={column.status} label={column.label} count={items.length} wipLimit={wipLimitsByProject[project.id]?.[column.status]} onWipLimitChange={changeWipLimit} collapsed={column.status === "DONE" && (collapsedDoneColumns[project.id] ?? true)} onToggleCollapse={column.status === "DONE" ? () => setCollapsedDoneColumns((current) => ({ ...current, [project.id]: !(current[project.id] ?? true) })) : undefined}>
                  {items.map((todo) => (
                    <ProjectKanbanCard
                      key={todo.id}
                      project={project}
                      todo={todo}
                      parent={todo.parentTodoId ? indexed.todoById.get(todo.parentTodoId) : undefined}
                      childCount={indexed.childCountByParentId.get(todo.id) || 0}
                      milestone={todo.milestoneId ? indexed.milestoneById.get(todo.milestoneId) : undefined}
                      milestones={milestones}
                      today={today}
                      onAddTodo={onAddTodo}
                      onUpdateTodo={onUpdateTodo}
                      onToggleTodo={onToggleTodo}
                      onOpenDetails={setEditingTodo}
                    />
                  ))}
                  {!items.length ? <p className="py-8 text-center text-xs text-ink-600">여기로 Todo를 드래그하세요</p> : null}
                </KanbanColumn>
              );
            })}
          </div>
        </div>
      </DndContext> : (
        <div className="overflow-x-auto rounded-lg border border-ink-700/70 bg-ink-900/35">
          <table className="w-full min-w-[58rem] text-left text-sm">
            <thead className="border-b border-ink-700/65 bg-ink-900/80 text-xs text-ink-400">
              <tr><th scope="col" className="px-3 py-2.5">작업</th><th scope="col" className="px-3 py-2.5">상태</th><th scope="col" className="px-3 py-2.5">우선순위</th><th scope="col" className="px-3 py-2.5">마일스톤</th><th scope="col" className="px-3 py-2.5">작업일</th><th scope="col" className="px-3 py-2.5">마감일</th><th scope="col" className="w-12 px-3 py-2.5"><span className="sr-only">작업 편집</span></th></tr>
            </thead>
            <tbody className="divide-y divide-ink-800/70">
              {visibleTodos.map((todo) => (
                <tr key={todo.id} className="hover:bg-ink-800/40">
                  <td className="max-w-[30rem] px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={() => onToggleTodo(todo.id)} className={`h-4 w-4 shrink-0 rounded-full border ${todo.completed ? "border-success bg-success" : "border-ink-600"}`} aria-label={`${todo.title} ${todo.completed ? "미완료로" : "완료로"} 변경`} />
                      <button type="button" onClick={() => setEditingTodo(todo)} className={`truncate text-left font-semibold hover:text-accent-200 ${todo.completed ? "text-ink-500 line-through" : "text-ink-100"}`}>{todo.title}</button>
                    </div>
                    {todo.parentTodoId && indexed.todoById.get(todo.parentTodoId) ? <p className="ml-6 mt-1 truncate text-[11px] text-ink-400">상위 작업: {indexed.todoById.get(todo.parentTodoId)?.title}</p> : null}
                  </td>
                  <td className="px-3 py-2.5"><select className="field h-8 min-h-8 w-28 py-0.5 text-xs" value={statusOf(todo)} onChange={(event) => { const nextStatus = event.target.value as TodoWorkflowStatus; void onUpdateTodo(todo.id, { workflowStatus: nextStatus, completed: nextStatus === "DONE" }); }} disabled={project.archived} aria-label={`${todo.title} 상태`}>{(["TODO", "IN_PROGRESS", "BLOCKED", "DONE"] as const).map((status) => <option key={status} value={status}>{workflowStatusLabels[status]}</option>)}</select></td>
                  <td className="px-3 py-2.5 text-xs text-ink-300">{todo.priority === "HIGH" ? "높음" : todo.priority === "LOW" ? "낮음" : "보통"}</td>
                  <td className="px-3 py-2.5"><select className="field h-8 min-h-8 max-w-44 py-0.5 text-xs" value={todo.milestoneId || ""} onChange={(event) => void onUpdateTodo(todo.id, { projectId: project.id, milestoneId: event.target.value || undefined })} disabled={project.archived} aria-label={`${todo.title} 마일스톤`}><option value="">미지정</option>{milestones.map((milestone) => <option key={milestone.id} value={milestone.id}>{milestone.title}</option>)}</select></td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-xs text-ink-300">{todo.date === "9999-12-31" ? "—" : todo.date}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-xs">{todo.dueDate ? <span className={isOverdueByDeadline(todo, today) ? "text-red-200" : isDueSoon(todo, today) ? "text-amber-200" : "text-ink-300"}>{todo.dueDate}</span> : <span className="text-ink-600">—</span>}</td>
                  <td className="px-3 py-2.5"><button type="button" className="icon-btn h-8 w-8" onClick={() => setEditingTodo(todo)} aria-label={`${todo.title} 편집`}><Pencil size={14} /></button></td>
                </tr>
              ))}
              {!visibleTodos.length ? <tr><td colSpan={7} className="px-3 py-12 text-center text-sm text-ink-400">검색 조건에 맞는 프로젝트 작업이 없습니다.</td></tr> : null}
            </tbody>
          </table>
        </div>
      )}
      {editingTodo ? <TodoEditModal todo={editingTodo} categories={categories} projects={projects} onClose={() => setEditingTodo(null)} onSave={onUpdateTodo} presentation="side-panel" /> : null}
    </section>
  );
}
