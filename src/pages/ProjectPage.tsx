import { FormEvent, useEffect, useMemo, useState } from "react";
import { Archive, ArchiveRestore, CheckCircle2, CircleDot, FolderKanban, PauseCircle, Plus, Target, Trash2 } from "lucide-react";
import { TodoForm } from "../components/todo/TodoForm";
import { todayKey } from "../lib/date";
import { isDueSoon, isOverdueByDeadline } from "../lib/todo";
import type { Category } from "../types/category";
import type { Milestone, MilestoneInput, Project, ProjectInput, ProjectStatus } from "../types/project";
import type { Todo, TodoInput, TodoWorkflowStatus } from "../types/todo";

const projectStatusLabel: Record<ProjectStatus, string> = { PLANNING: "계획", ACTIVE: "진행 중", ON_HOLD: "보류", DONE: "완료" };
const workflowColumns: Array<{ status: TodoWorkflowStatus; label: string }> = [
  { status: "TODO", label: "Todo" }, { status: "IN_PROGRESS", label: "진행 중" }, { status: "BLOCKED", label: "Blocked" }, { status: "DONE", label: "완료" },
];

export function ProjectPage({
  projects, milestones, todos, categories, onAddProject, onUpdateProject, onArchiveProject, onUnarchiveProject,
  onAddMilestone, onUpdateMilestone, onDeleteMilestone, onAddTodo, onUpdateTodo, onToggleTodo,
}: {
  projects: Project[];
  milestones: Milestone[];
  todos: Todo[];
  categories: Category[];
  onAddProject: (input: ProjectInput) => Promise<Project | undefined> | Project | undefined;
  onUpdateProject: (id: string, input: Partial<ProjectInput>) => Promise<Project | undefined> | Project | undefined;
  onArchiveProject: (id: string) => Promise<Project | undefined> | Project | undefined;
  onUnarchiveProject: (id: string) => Promise<Project | undefined> | Project | undefined;
  onAddMilestone: (input: MilestoneInput) => Promise<Milestone | undefined> | Milestone | undefined;
  onUpdateMilestone: (id: string, input: Partial<MilestoneInput>) => Promise<Milestone | undefined> | Milestone | undefined;
  onDeleteMilestone: (id: string) => Promise<boolean> | boolean;
  onAddTodo: (input: TodoInput) => Promise<Todo | undefined> | Todo | undefined;
  onUpdateTodo: (id: string, input: Partial<Omit<Todo, "id" | "createdAt">>) => Promise<Todo | undefined> | Todo | undefined;
  onToggleTodo: (id: string) => void;
}) {
  const activeProjects = projects.filter((project) => !project.archived);
  const archivedProjects = projects.filter((project) => project.archived);
  const [showArchived, setShowArchived] = useState(false);
  const visibleProjects = showArchived ? archivedProjects : activeProjects;
  const [selectedId, setSelectedId] = useState("");
  const [newName, setNewName] = useState("");
  const [newTargetDate, setNewTargetDate] = useState("");
  const [milestoneTitle, setMilestoneTitle] = useState("");
  const [milestoneDate, setMilestoneDate] = useState("");

  useEffect(() => {
    const candidates = showArchived ? archivedProjects : activeProjects;
    if (!candidates.some((project) => project.id === selectedId)) setSelectedId(candidates[0]?.id || "");
  }, [activeProjects, archivedProjects, selectedId, showArchived]);

  const selected = projects.find((project) => project.id === selectedId);
  const projectTodos = useMemo(() => todos.filter((todo) => todo.projectId === selectedId && !todo.archived), [selectedId, todos]);
  const projectMilestones = useMemo(() => milestones.filter((milestone) => milestone.projectId === selectedId), [milestones, selectedId]);
  const completed = projectTodos.filter((todo) => todo.completed).length;
  const progress = projectTodos.length ? Math.round((completed / projectTodos.length) * 100) : 0;
  const today = todayKey();

  const createProject = async (event: FormEvent) => {
    event.preventDefault();
    if (!newName.trim()) return;
    const created = await onAddProject({ name: newName.trim(), targetDate: newTargetDate || undefined, status: "ACTIVE" });
    if (created) { setSelectedId(created.id); setNewName(""); setNewTargetDate(""); setShowArchived(false); }
  };

  const createMilestone = async (event: FormEvent) => {
    event.preventDefault();
    if (!selected || !milestoneTitle.trim()) return;
    const created = await onAddMilestone({ projectId: selected.id, title: milestoneTitle.trim(), targetDate: milestoneDate || undefined });
    if (created) { setMilestoneTitle(""); setMilestoneDate(""); }
  };

  return (
    <div className="space-y-5">
      <section>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div><h2 className="text-2xl font-bold text-ink-100 sm:text-3xl">프로젝트</h2><p className="mt-2 text-sm text-ink-400">장기 작업을 마일스톤과 Kanban으로 관리하고, 실행할 Todo는 기존 오늘·주간·월간 화면에서 이어서 처리합니다.</p></div>
          <button type="button" className="btn-secondary" onClick={() => setShowArchived((value) => !value)}>{showArchived ? <ArchiveRestore size={16} /> : <Archive size={16} />}{showArchived ? "진행 프로젝트" : `보관함 ${archivedProjects.length}`}</button>
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[18rem_minmax(0,1fr)]">
        <aside className="space-y-3">
          {!showArchived ? (
            <form className="app-card space-y-2 p-3" onSubmit={createProject}>
              <input className="field" value={newName} onChange={(event) => setNewName(event.target.value)} placeholder="새 프로젝트 이름" />
              <input className="field" type="date" value={newTargetDate} onChange={(event) => setNewTargetDate(event.target.value)} aria-label="프로젝트 목표일" />
              <button className="btn-primary w-full" type="submit" disabled={!newName.trim()}><Plus size={16} />프로젝트 추가</button>
            </form>
          ) : null}
          <div className="app-card space-y-1 p-2">
            {visibleProjects.length ? visibleProjects.map((project) => (
              <button key={project.id} type="button" onClick={() => setSelectedId(project.id)} className={`flex min-h-11 w-full items-center gap-2 rounded-lg px-3 text-left text-sm font-semibold transition ${selectedId === project.id ? "bg-accent-500/20 text-ink-100" : "text-ink-400 hover:bg-ink-800 hover:text-ink-100"}`}>
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: project.color || "#6366f1" }} /><span className="min-w-0 flex-1 truncate">{project.name}</span><span className="text-[10px] text-ink-500">{projectStatusLabel[project.status]}</span>
              </button>
            )) : <p className="px-3 py-6 text-center text-sm text-ink-500">{showArchived ? "보관된 프로젝트가 없습니다." : "프로젝트를 하나 만들어보세요."}</p>}
          </div>
        </aside>

        {selected ? (
          <div className="min-w-0 space-y-4">
            <section className="app-card p-4 sm:p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2"><FolderKanban size={20} className="text-accent-300" /><h3 className="text-xl font-bold text-ink-100">{selected.name}</h3><span className="rounded-full border border-ink-700 px-2 py-0.5 text-xs text-ink-300">{projectStatusLabel[selected.status]}</span></div>
                  <p className="mt-2 text-sm text-ink-400">{selected.description || "설명이 없습니다."}</p>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-ink-400"><span>진행률 {progress}% ({completed}/{projectTodos.length})</span>{selected.targetDate ? <span>목표일 {selected.targetDate}</span> : null}<span>마일스톤 {projectMilestones.length}개</span></div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <select className="field min-h-10 w-auto py-1.5 text-sm" value={selected.status} onChange={(event) => void onUpdateProject(selected.id, { status: event.target.value as ProjectStatus })}>
                    <option value="PLANNING">계획</option><option value="ACTIVE">진행 중</option><option value="ON_HOLD">보류</option><option value="DONE">완료</option>
                  </select>
                  {selected.archived ? <button type="button" className="btn-secondary" onClick={() => void onUnarchiveProject(selected.id)}><ArchiveRestore size={15} />복원</button> : <button type="button" className="btn-secondary" onClick={() => void onArchiveProject(selected.id)}><Archive size={15} />보관</button>}
                </div>
              </div>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-ink-800"><div className="h-full rounded-full bg-accent-500 transition-all" style={{ width: `${progress}%` }} /></div>
            </section>

            {!selected.archived ? <TodoForm compact submitLabel="프로젝트 Todo 추가" categories={categories} projects={activeProjects} defaultProjectId={selected.id} onAdd={onAddTodo} /> : null}

            <section className="app-card p-4">
              <div className="mb-3 flex items-center gap-2"><Target size={17} className="text-accent-300" /><h3 className="font-bold text-ink-100">마일스톤</h3></div>
              {!selected.archived ? (
                <form className="mb-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_10rem_auto]" onSubmit={createMilestone}>
                  <input className="field" value={milestoneTitle} onChange={(event) => setMilestoneTitle(event.target.value)} placeholder="마일스톤" />
                  <input className="field" type="date" value={milestoneDate} onChange={(event) => setMilestoneDate(event.target.value)} />
                  <button className="btn-secondary" type="submit" disabled={!milestoneTitle.trim()}><Plus size={15} />추가</button>
                </form>
              ) : null}
              <div className="space-y-2">
                {projectMilestones.length ? projectMilestones.map((milestone) => (
                  <div key={milestone.id} className="flex items-center gap-2 rounded-lg bg-ink-950/45 p-2">
                    <button type="button" className="icon-btn h-9 w-9 rounded-md" onClick={() => void onUpdateMilestone(milestone.id, { status: milestone.status === "DONE" ? "TODO" : "DONE" })} aria-label="마일스톤 완료 토글">{milestone.status === "DONE" ? <CheckCircle2 size={16} className="text-emerald-300" /> : <CircleDot size={16} />}</button>
                    <div className="min-w-0 flex-1"><p className={`truncate text-sm font-semibold ${milestone.status === "DONE" ? "text-ink-500 line-through" : "text-ink-100"}`}>{milestone.title}</p>{milestone.targetDate ? <p className="text-[11px] text-ink-500">{milestone.targetDate}</p> : null}</div>
                    <button type="button" className="icon-btn h-9 w-9 rounded-md hover:text-red-200" onClick={() => window.confirm("마일스톤을 삭제할까요? 연결된 Todo의 마일스톤 지정은 해제됩니다.") && void onDeleteMilestone(milestone.id)} aria-label="마일스톤 삭제"><Trash2 size={14} /></button>
                  </div>
                )) : <p className="py-4 text-center text-sm text-ink-500">아직 마일스톤이 없습니다.</p>}
              </div>
            </section>

            <section className="space-y-3">
              <div><h3 className="text-base font-bold text-ink-100">Kanban</h3><p className="mt-1 text-xs text-ink-500">상태 선택으로 작업 흐름을 이동합니다. Drag & drop은 후속 UX 확장에서 붙입니다.</p></div>
              <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-4">
                {workflowColumns.map((column) => {
                  const items = projectTodos.filter((todo) => (todo.workflowStatus || (todo.completed ? "DONE" : "TODO")) === column.status);
                  return (
                    <div key={column.status} className="app-card min-h-44 p-3">
                      <div className="mb-3 flex items-center justify-between gap-2"><h4 className="text-sm font-bold text-ink-100">{column.label}</h4><span className="rounded-full bg-ink-950/70 px-2 py-0.5 text-xs text-ink-400">{items.length}</span></div>
                      <div className="space-y-2">
                        {items.map((todo) => {
                          const overdue = isOverdueByDeadline(todo, today); const dueSoon = isDueSoon(todo, today);
                          return (
                            <article key={todo.id} className="rounded-lg border border-ink-700/70 bg-ink-950/45 p-3">
                              <div className="flex items-start gap-2"><button type="button" onClick={() => onToggleTodo(todo.id)} className={`mt-0.5 h-4 w-4 shrink-0 rounded-full border ${todo.completed ? "border-success bg-success" : "border-ink-600"}`} aria-label="완료 토글" /><div className="min-w-0 flex-1"><p className={`break-words text-sm font-semibold ${todo.completed ? "text-ink-500 line-through" : "text-ink-100"}`}>{todo.title}</p><div className="mt-2 flex flex-wrap gap-1.5 text-[10px] text-ink-400">{todo.estimateMinutes ? <span className="rounded bg-ink-800 px-1.5 py-0.5">{todo.estimateMinutes}분</span> : null}{todo.dueDate ? <span className={`rounded px-1.5 py-0.5 ${overdue ? "bg-danger/20 text-red-100" : dueSoon ? "bg-warning/20 text-amber-100" : "bg-ink-800"}`}>마감 {todo.dueDate}</span> : null}</div></div></div>
                              <select className="field mt-2 min-h-9 py-1 text-xs" value={todo.workflowStatus || (todo.completed ? "DONE" : "TODO")} onChange={(event) => void onUpdateTodo(todo.id, { workflowStatus: event.target.value as TodoWorkflowStatus, completed: event.target.value === "DONE" })}>
                                {workflowColumns.map((target) => <option key={target.status} value={target.status}>{target.label}</option>)}
                              </select>
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
          </div>
        ) : (
          <div className="app-card flex min-h-64 items-center justify-center p-6 text-center"><div><PauseCircle className="mx-auto text-ink-600" /><p className="mt-3 text-sm font-semibold text-ink-400">프로젝트를 선택하거나 새로 만들어주세요.</p></div></div>
        )}
      </div>
    </div>
  );
}
