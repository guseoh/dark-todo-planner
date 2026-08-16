import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
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

export function ProjectKanban({ project, todos, milestones, onAddTodo, onUpdateTodo, onToggleTodo }: ProjectKanbanProps) {
  const [subtaskParentId, setSubtaskParentId] = useState("");
  const [subtaskTitle, setSubtaskTitle] = useState("");
  const today = todayKey();

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

  const createSubtask = async (parent: Todo) => {
    const title = subtaskTitle.trim();
    if (!title) return;

    const scheduled = parent.planningState === "SCHEDULED";
    const created = await onAddTodo({
      title,
      projectId: project.id,
      milestoneId: parent.milestoneId,
      parentTodoId: parent.id,
      date: scheduled ? parent.date : today,
      planningState: scheduled ? "SCHEDULED" : "INBOX",
      priority: parent.priority,
    });
    if (!created) return;

    setSubtaskParentId("");
    setSubtaskTitle("");
  };

  return (
    <section className="space-y-3">
      <div>
        <h3 className="text-base font-bold text-ink-100">Kanban</h3>
        <p className="mt-1 text-xs text-ink-500">상태와 마일스톤, 하위 작업을 한곳에서 조정합니다.</p>
      </div>

      <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-4">
        {workflowColumns.map((column) => {
          const items = indexed.byStatus.get(column.status) || [];
          return (
            <div key={column.status} className="app-card min-h-44 p-3">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h4 className="text-sm font-bold text-ink-100">{column.label}</h4>
                <span className="rounded-full border border-ink-800/70 bg-ink-950/45 px-2 py-0.5 text-xs text-ink-400">{items.length}</span>
              </div>

              <div className="space-y-2">
                {items.map((todo) => {
                  const overdue = isOverdueByDeadline(todo, today);
                  const dueSoon = isDueSoon(todo, today);
                  const parent = todo.parentTodoId ? indexed.todoById.get(todo.parentTodoId) : undefined;
                  const childCount = indexed.childCountByParentId.get(todo.id) || 0;
                  const milestone = todo.milestoneId ? indexed.milestoneById.get(todo.milestoneId) : undefined;

                  return (
                    <article key={todo.id} className="rounded-lg border border-ink-800/80 bg-ink-950/25 p-3">
                      <div className="flex items-start gap-2">
                        <button type="button" onClick={() => onToggleTodo(todo.id)} className={`mt-0.5 h-4 w-4 shrink-0 rounded-full border ${todo.completed ? "border-success bg-success" : "border-ink-600"}`} aria-label="완료 토글" />
                        <div className="min-w-0 flex-1">
                          {parent ? <p className="mb-1 truncate text-[10px] font-semibold text-accent-300">↳ {parent.title}</p> : null}
                          <p className={`break-words text-sm font-semibold ${todo.completed ? "text-ink-500 line-through" : "text-ink-100"}`}>{todo.title}</p>
                          <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] text-ink-400">
                            {milestone ? <span className="rounded border border-accent-500/25 bg-accent-500/[0.06] px-1.5 py-0.5 text-accent-200">{milestone.title}</span> : null}
                            {childCount ? <span className="rounded border border-accent-500/25 bg-accent-500/[0.06] px-1.5 py-0.5 text-accent-200">하위 {childCount}</span> : null}
                            {todo.estimateMinutes ? <span className="rounded border border-ink-800/70 bg-ink-900/60 px-1.5 py-0.5">{todo.estimateMinutes}분</span> : null}
                            {todo.dueDate ? <span className={`rounded border px-1.5 py-0.5 ${overdue ? "border-danger/30 bg-danger/[0.07] text-red-100" : dueSoon ? "border-warning/30 bg-warning/[0.07] text-amber-100" : "border-ink-800/70 bg-ink-900/60"}`}>마감 {todo.dueDate}</span> : null}
                          </div>
                        </div>
                      </div>

                      <div className="mt-2 grid gap-2">
                        <select className="field min-h-9 py-1 text-xs" value={statusOf(todo)} onChange={(event) => void onUpdateTodo(todo.id, { workflowStatus: event.target.value as TodoWorkflowStatus, completed: event.target.value === "DONE" })}>
                          {workflowColumns.map((target) => <option key={target.status} value={target.status}>{target.label}</option>)}
                        </select>
                        <select className="field min-h-9 py-1 text-xs" value={todo.milestoneId || ""} onChange={(event) => void onUpdateTodo(todo.id, { projectId: project.id, milestoneId: event.target.value || undefined })} disabled={project.archived} aria-label={`${todo.title} 마일스톤`}>
                          <option value="">마일스톤 없음</option>
                          {milestones.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
                        </select>
                      </div>

                      {!project.archived ? (
                        <button type="button" className="mt-2 text-[11px] font-semibold text-ink-500 hover:text-accent-200" onClick={() => { setSubtaskParentId(subtaskParentId === todo.id ? "" : todo.id); setSubtaskTitle(""); }}>
                          <Plus size={12} className="mr-1 inline" />하위 Todo
                        </button>
                      ) : null}

                      {subtaskParentId === todo.id ? (
                        <div className="mt-2 flex gap-1.5">
                          <input className="field min-h-9 py-1 text-xs" value={subtaskTitle} onChange={(event) => setSubtaskTitle(event.target.value)} placeholder="하위 작업" onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void createSubtask(todo); } }} />
                          <button type="button" className="btn-secondary min-h-9 px-2 py-1 text-xs" onClick={() => void createSubtask(todo)} disabled={!subtaskTitle.trim()}>추가</button>
                        </div>
                      ) : null}
                    </article>
                  );
                })}

                {!items.length ? <p className="py-4 text-center text-xs text-ink-600">비어 있음</p> : null}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
