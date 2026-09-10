import { DndContext, PointerSensor, closestCenter, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Plus } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { todayKey } from "../../lib/date";
import { isDueSoon, isOverdueByDeadline } from "../../lib/todo";
import type { Milestone, Project } from "../../types/project";
import type { Todo, TodoInput, TodoWorkflowStatus } from "../../types/todo";

const workflowColumns: Array<{ status: TodoWorkflowStatus; label: string }> = [
  { status: "TODO", label: "Todo" },
  { status: "IN_PROGRESS", label: "진행 중" },
  { status: "BLOCKED", label: "Blocked" },
  { status: "DONE", label: "완료" },
];

type ProjectKanbanProps = {
  project: Project;
  todos: Todo[];
  milestones: Milestone[];
  onAddTodo: (input: TodoInput) => Promise<Todo | undefined> | Todo | undefined;
  onUpdateTodo: (id: string, input: Partial<Omit<Todo, "id" | "createdAt">>) => Promise<Todo | undefined> | Todo | undefined;
  onToggleTodo: (id: string) => void;
};

const statusOf = (todo: Todo): TodoWorkflowStatus => todo.workflowStatus || (todo.completed ? "DONE" : "TODO");

function KanbanColumn({ status, label, count, children }: { status: TodoWorkflowStatus; label: string; count: number; children: ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: `column:${status}` });
  return (
    <section ref={setNodeRef} className={`app-card min-h-[18rem] w-[17rem] shrink-0 p-3 transition sm:w-auto ${isOver ? "border-accent-500/55 bg-accent-500/[0.05]" : ""}`}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h4 className="text-sm font-bold text-ink-100">{label}</h4>
        <span className="rounded-full border border-ink-800/70 bg-ink-950/45 px-2 py-0.5 text-xs text-ink-400">{count}</span>
      </div>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function ProjectKanbanCard({ project, todo, parent, childCount, milestone, milestones, today, onAddTodo, onUpdateTodo, onToggleTodo }: {
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
    <article ref={setNodeRef} style={{ transform: CSS.Translate.toString(transform), opacity: isDragging ? 0.55 : 1 }} className="rounded-lg border border-ink-800/80 bg-ink-950/35 p-3 shadow-sm transition hover:border-ink-700">
      <div className="flex items-start gap-2">
        <button type="button" onClick={() => onToggleTodo(todo.id)} className={`mt-0.5 h-4 w-4 shrink-0 rounded-full border ${todo.completed ? "border-success bg-success" : "border-ink-600"}`} aria-label="완료 토글" />
        <div className="min-w-0 flex-1">
          {parent ? <p className="mb-1 truncate text-[10px] font-semibold text-accent-300">↳ {parent.title}</p> : null}
          <p className={`break-words text-sm font-semibold ${todo.completed ? "text-ink-500 line-through" : "text-ink-100"}`}>{todo.title}</p>
          <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] text-ink-400">
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

export function ProjectKanban({ project, todos, milestones, onAddTodo, onUpdateTodo, onToggleTodo }: ProjectKanbanProps) {
  const today = todayKey();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

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
      <div>
        <h3 className="text-base font-bold text-ink-100">Kanban</h3>
        <p className="mt-1 text-xs text-ink-500">카드 오른쪽 핸들을 다른 열로 드래그하면 상태가 바로 변경됩니다.</p>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <div className="overflow-x-auto pb-2">
          <div className="grid min-w-[68rem] grid-cols-4 gap-3">
            {workflowColumns.map((column) => {
              const items = indexed.byStatus.get(column.status) || [];
              return (
                <KanbanColumn key={column.status} status={column.status} label={column.label} count={items.length}>
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
                    />
                  ))}
                  {!items.length ? <p className="py-8 text-center text-xs text-ink-600">여기로 Todo를 드래그하세요</p> : null}
                </KanbanColumn>
              );
            })}
          </div>
        </div>
      </DndContext>
    </section>
  );
}
