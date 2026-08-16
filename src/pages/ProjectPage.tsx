import { FormEvent, useEffect, useMemo, useState } from "react";
import { Archive, ArchiveRestore, CheckCircle2, CircleDot, ExternalLink, FileText, FolderKanban, GitBranch, Link2, PauseCircle, Pencil, Plus, Save, Target, Trash2, X } from "lucide-react";
import { ProjectOverviewTools } from "../components/project/ProjectOverviewTools";
import { TodoForm } from "../components/todo/TodoForm";
import type { ProjectDuplicateMode } from "../hooks/useProjects";
import { todayKey } from "../lib/date";
import { isDueSoon, isOverdueByDeadline } from "../lib/todo";
import type { Category } from "../types/category";
import type { Memo } from "../types/memo";
import type { Milestone, MilestoneInput, Project, ProjectDecision, ProjectDecisionInput, ProjectInput, ProjectResource, ProjectStatus } from "../types/project";
import type { Todo, TodoInput, TodoWorkflowStatus } from "../types/todo";

const projectStatusLabel: Record<ProjectStatus, string> = { PLANNING: "계획", ACTIVE: "진행 중", ON_HOLD: "보류", DONE: "완료" };
const workflowColumns: Array<{ status: TodoWorkflowStatus; label: string }> = [
  { status: "TODO", label: "Todo" }, { status: "IN_PROGRESS", label: "진행 중" }, { status: "BLOCKED", label: "Blocked" }, { status: "DONE", label: "완료" },
];

const memoTitle = (memo: Memo) => memo.title || memo.content.split("\n").find((line) => line.trim())?.replace(/^[-#>*\s]+/, "").slice(0, 36) || "제목 없음";
const createResourceId = () => typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `resource-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const isHttpUrl = (value: string) => {
  try {
    const protocol = new URL(value).protocol;
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
};

export function ProjectPage({
  projects, milestones, decisions, memos, todos, categories, onAddProject, onUpdateProject, onDuplicateProject, onArchiveProject, onUnarchiveProject,
  onAddMilestone, onUpdateMilestone, onDeleteMilestone, onAddDecision, onDeleteDecision, onAddTodo, onUpdateTodo, onToggleTodo,
}: {
  projects: Project[];
  milestones: Milestone[];
  decisions: ProjectDecision[];
  memos: Memo[];
  todos: Todo[];
  categories: Category[];
  onAddProject: (input: ProjectInput) => Promise<Project | undefined> | Project | undefined;
  onUpdateProject: (id: string, input: Partial<ProjectInput>) => Promise<Project | undefined> | Project | undefined;
  onDuplicateProject: (id: string, input: { name: string; mode: ProjectDuplicateMode }) => Promise<Project | undefined> | Project | undefined;
  onArchiveProject: (id: string) => Promise<Project | undefined> | Project | undefined;
  onUnarchiveProject: (id: string) => Promise<Project | undefined> | Project | undefined;
  onAddMilestone: (input: MilestoneInput) => Promise<Milestone | undefined> | Milestone | undefined;
  onUpdateMilestone: (id: string, input: Partial<MilestoneInput>) => Promise<Milestone | undefined> | Milestone | undefined;
  onDeleteMilestone: (id: string) => Promise<boolean> | boolean;
  onAddDecision: (input: ProjectDecisionInput) => Promise<ProjectDecision | undefined> | ProjectDecision | undefined;
  onDeleteDecision: (id: string) => Promise<boolean> | boolean;
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
  const [newTodoMilestoneId, setNewTodoMilestoneId] = useState("");
  const [decisionTitle, setDecisionTitle] = useState("");
  const [decisionText, setDecisionText] = useState("");
  const [decisionRationale, setDecisionRationale] = useState("");
  const [decisionDate, setDecisionDate] = useState(todayKey());
  const [subtaskParentId, setSubtaskParentId] = useState("");
  const [subtaskTitle, setSubtaskTitle] = useState("");
  const [editingProject, setEditingProject] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [projectDescription, setProjectDescription] = useState("");
  const [projectStartDate, setProjectStartDate] = useState("");
  const [projectTargetDate, setProjectTargetDate] = useState("");
  const [projectColor, setProjectColor] = useState("#0b72d7");
  const [resourceLabel, setResourceLabel] = useState("");
  const [resourceUrl, setResourceUrl] = useState("");
  const [resourceError, setResourceError] = useState("");

  useEffect(() => {
    const candidates = showArchived ? archivedProjects : activeProjects;
    if (!candidates.some((project) => project.id === selectedId)) setSelectedId(candidates[0]?.id || "");
  }, [activeProjects, archivedProjects, selectedId, showArchived]);

  useEffect(() => {
    setEditingProject(false);
    setResourceLabel("");
    setResourceUrl("");
    setResourceError("");
    setNewTodoMilestoneId("");
  }, [selectedId]);

  const selected = projects.find((project) => project.id === selectedId);
  const projectTodos = useMemo(() => todos.filter((todo) => todo.projectId === selectedId && !todo.archived), [selectedId, todos]);
  const projectMilestones = useMemo(() => milestones.filter((milestone) => milestone.projectId === selectedId), [milestones, selectedId]);
  const projectDecisions = useMemo(() => decisions.filter((decision) => decision.projectId === selectedId), [decisions, selectedId]);
  const linkedMemos = useMemo(() => memos.filter((memo) => memo.projectIds.includes(selectedId)), [memos, selectedId]);
  const completed = projectTodos.filter((todo) => todo.completed).length;
  const progress = projectTodos.length ? Math.round((completed / projectTodos.length) * 100) : 0;
  const unassignedMilestoneTodos = projectTodos.filter((todo) => !todo.milestoneId).length;
  const today = todayKey();

  const createProject = async (event: FormEvent) => {
    event.preventDefault();
    if (!newName.trim()) return;
    const created = await onAddProject({ name: newName.trim(), targetDate: newTargetDate || undefined, status: "ACTIVE", resources: [] });
    if (created) { setSelectedId(created.id); setNewName(""); setNewTargetDate(""); setShowArchived(false); }
  };

  const beginProjectEdit = () => {
    if (!selected) return;
    setProjectName(selected.name);
    setProjectDescription(selected.description || "");
    setProjectStartDate(selected.startDate || "");
    setProjectTargetDate(selected.targetDate || "");
    setProjectColor(selected.color || "#0b72d7");
    setEditingProject(true);
  };

  const saveProjectInfo = async (event: FormEvent) => {
    event.preventDefault();
    if (!selected || !projectName.trim()) return;
    const updated = await onUpdateProject(selected.id, {
      name: projectName.trim(),
      description: projectDescription.trim() || undefined,
      startDate: projectStartDate || undefined,
      targetDate: projectTargetDate || undefined,
      color: projectColor,
    });
    if (updated) setEditingProject(false);
  };

  const addResource = async (event: FormEvent) => {
    event.preventDefault();
    if (!selected || selected.archived) return;
    const label = resourceLabel.trim();
    const url = resourceUrl.trim();
    if (!label) { setResourceError("링크 이름을 입력하세요."); return; }
    if (!isHttpUrl(url)) { setResourceError("http 또는 https 주소를 입력하세요."); return; }
    const resources = selected.resources || [];
    if (resources.length >= 12) { setResourceError("프로젝트 자료 링크는 최대 12개까지 등록할 수 있습니다."); return; }
    if (resources.some((resource) => resource.url === url)) { setResourceError("이미 등록된 주소입니다."); return; }
    const next: ProjectResource[] = [...resources, { id: createResourceId(), label, url }];
    const updated = await onUpdateProject(selected.id, { resources: next });
    if (updated) { setResourceLabel(""); setResourceUrl(""); setResourceError(""); }
  };

  const removeResource = async (resourceId: string) => {
    if (!selected || selected.archived) return;
    await onUpdateProject(selected.id, { resources: (selected.resources || []).filter((resource) => resource.id !== resourceId) });
  };

  const createMilestone = async (event: FormEvent) => {
    event.preventDefault();
    if (!selected || !milestoneTitle.trim()) return;
    const created = await onAddMilestone({ projectId: selected.id, title: milestoneTitle.trim(), targetDate: milestoneDate || undefined });
    if (created) { setMilestoneTitle(""); setMilestoneDate(""); }
  };

  const addProjectTodo = async (input: TodoInput) => {
    if (!selected) return undefined;
    const projectId = input.projectId || selected.id;
    return onAddTodo({
      ...input,
      projectId,
      milestoneId: projectId === selected.id ? (newTodoMilestoneId || undefined) : undefined,
    });
  };

  const createDecision = async (event: FormEvent) => {
    event.preventDefault();
    if (!selected || !decisionTitle.trim() || !decisionText.trim()) return;
    const created = await onAddDecision({ projectId: selected.id, title: decisionTitle.trim(), decision: decisionText.trim(), rationale: decisionRationale.trim() || undefined, decidedAt: decisionDate });
    if (created) { setDecisionTitle(""); setDecisionText(""); setDecisionRationale(""); setDecisionDate(todayKey()); }
  };

  const createSubtask = async (parent: Todo) => {
    const title = subtaskTitle.trim();
    if (!selected || !title) return;
    const scheduled = parent.planningState === "SCHEDULED";
    const created = await onAddTodo({
      title,
      projectId: selected.id,
      milestoneId: parent.milestoneId,
      parentTodoId: parent.id,
      date: scheduled ? parent.date : today,
      planningState: scheduled ? "SCHEDULED" : "INBOX",
      priority: parent.priority,
    });
    if (created) { setSubtaskParentId(""); setSubtaskTitle(""); }
  };

  return (
    <div className="space-y-5">
      <section>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div><h2 className="text-2xl font-bold text-ink-100 sm:text-3xl">프로젝트</h2><p className="mt-2 text-sm text-ink-400">장기 작업을 마일스톤·하위 작업·의사결정 기록과 함께 관리합니다.</p></div>
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
              <button key={project.id} type="button" onClick={() => setSelectedId(project.id)} className={`relative flex min-h-11 w-full items-center gap-2 rounded-lg border px-3 text-left text-sm font-semibold transition ${selectedId === project.id ? "border-ink-700/80 bg-ink-800 text-ink-100" : "border-transparent text-ink-400 hover:border-ink-800 hover:bg-ink-800/65 hover:text-ink-100"}`}>
                {selectedId === project.id ? <span aria-hidden="true" className="absolute bottom-2 left-0 top-2 w-0.5 rounded-full bg-accent-500" /> : null}
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: project.color || "#0b72d7" }} /><span className="min-w-0 flex-1 truncate">{project.name}</span><span className="text-[10px] text-ink-500">{projectStatusLabel[project.status]}</span>
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
                  <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-ink-400">
                    <span>진행률 {progress}% ({completed}/{projectTodos.length})</span>
                    {selected.startDate ? <span>시작일 {selected.startDate}</span> : null}
                    {selected.targetDate ? <span>목표일 {selected.targetDate}</span> : null}
                    <span>마일스톤 {projectMilestones.length}개</span><span>자료 {(selected.resources || []).length}개</span><span>연결 메모 {linkedMemos.length}개</span><span>결정 {projectDecisions.length}개</span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {!selected.archived ? <button type="button" className="btn-secondary" onClick={beginProjectEdit}><Pencil size={15} />정보 수정</button> : null}
                  <select className="field min-h-10 w-auto py-1.5 text-sm" value={selected.status} onChange={(event) => void onUpdateProject(selected.id, { status: event.target.value as ProjectStatus })} disabled={selected.archived}><option value="PLANNING">계획</option><option value="ACTIVE">진행 중</option><option value="ON_HOLD">보류</option><option value="DONE">완료</option></select>
                  {selected.archived ? <button type="button" className="btn-secondary" onClick={() => void onUnarchiveProject(selected.id)}><ArchiveRestore size={15} />복원</button> : <button type="button" className="btn-secondary" onClick={() => void onArchiveProject(selected.id)}><Archive size={15} />보관</button>}
                </div>
              </div>

              {editingProject ? (
                <form className="mt-4 grid gap-3 rounded-lg border border-ink-700/70 bg-ink-950/25 p-3 lg:grid-cols-2" onSubmit={saveProjectInfo}>
                  <label className="text-xs font-semibold text-ink-400">프로젝트 이름<input className="field mt-1.5" value={projectName} onChange={(event) => setProjectName(event.target.value)} maxLength={120} /></label>
                  <label className="text-xs font-semibold text-ink-400">색상<div className="mt-1.5 flex gap-2"><input className="h-10 w-14 rounded-md border border-ink-700 bg-ink-950 p-1" type="color" value={projectColor} onChange={(event) => setProjectColor(event.target.value)} /><input className="field" value={projectColor} onChange={(event) => setProjectColor(event.target.value)} maxLength={20} /></div></label>
                  <label className="text-xs font-semibold text-ink-400">시작일<input className="field mt-1.5" type="date" value={projectStartDate} onChange={(event) => setProjectStartDate(event.target.value)} /></label>
                  <label className="text-xs font-semibold text-ink-400">목표일<input className="field mt-1.5" type="date" value={projectTargetDate} onChange={(event) => setProjectTargetDate(event.target.value)} /></label>
                  <label className="text-xs font-semibold text-ink-400 lg:col-span-2">설명<textarea className="field mt-1.5 min-h-24 resize-y" value={projectDescription} onChange={(event) => setProjectDescription(event.target.value)} maxLength={1000} placeholder="프로젝트의 목표와 범위를 짧게 기록하세요." /></label>
                  <div className="flex justify-end gap-2 lg:col-span-2"><button type="button" className="btn-secondary" onClick={() => setEditingProject(false)}><X size={15} />취소</button><button type="submit" className="btn-primary" disabled={!projectName.trim()}><Save size={15} />저장</button></div>
                </form>
              ) : null}

              <div className="mt-4 h-2 overflow-hidden rounded-full bg-ink-800"><div className="h-full rounded-full bg-accent-500 transition-all" style={{ width: `${progress}%` }} /></div>

              <div className="mt-4 border-t border-ink-800/80 pt-4">
                <div className="flex flex-wrap items-center justify-between gap-2"><div className="flex items-center gap-2"><Link2 size={16} className="text-accent-300" /><h4 className="text-sm font-bold text-ink-100">자료 링크</h4><span className="text-[11px] text-ink-500">Notion · GitHub · 배포 · 문서</span></div><span className="text-[11px] text-ink-500">{(selected.resources || []).length}/12</span></div>
                {(selected.resources || []).length ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {(selected.resources || []).map((resource) => (
                      <div key={resource.id} className="inline-flex max-w-full items-center rounded-md border border-ink-700/70 bg-ink-950/35">
                        <a className="inline-flex min-h-9 min-w-0 items-center gap-1.5 px-2.5 text-xs font-semibold text-ink-300 hover:text-accent-200" href={resource.url} target="_blank" rel="noreferrer" title={resource.url}><ExternalLink size={13} className="shrink-0" /><span className="truncate">{resource.label}</span></a>
                        {!selected.archived ? <button type="button" className="flex h-9 w-8 shrink-0 items-center justify-center border-l border-ink-800 text-ink-600 hover:text-red-200" onClick={() => void removeResource(resource.id)} aria-label={`${resource.label} 링크 삭제`}><X size={13} /></button> : null}
                      </div>
                    ))}
                  </div>
                ) : <p className="mt-3 text-xs text-ink-500">자주 여는 Notion 문서, GitHub 저장소, 배포 주소 등을 연결해두면 프로젝트 화면에서 바로 이동할 수 있습니다.</p>}
                {!selected.archived ? (
                  <form className="mt-3 grid gap-2 lg:grid-cols-[11rem_minmax(0,1fr)_auto]" onSubmit={addResource}>
                    <input className="field min-h-9 py-1.5 text-xs" value={resourceLabel} onChange={(event) => setResourceLabel(event.target.value)} placeholder="예: Notion 설계" maxLength={80} />
                    <input className="field min-h-9 py-1.5 text-xs" type="url" value={resourceUrl} onChange={(event) => { setResourceUrl(event.target.value); setResourceError(""); }} placeholder="https://..." maxLength={2048} />
                    <button type="submit" className="btn-secondary min-h-9 py-1.5 text-xs" disabled={!resourceLabel.trim() || !resourceUrl.trim()}><Plus size={14} />링크 추가</button>
                    {resourceError ? <p className="text-xs font-semibold text-red-200 lg:col-span-3">{resourceError}</p> : null}
                  </form>
                ) : null}
              </div>
            </section>

            <ProjectOverviewTools project={selected} todos={projectTodos} milestones={projectMilestones} onUpdateTodo={onUpdateTodo} onDuplicateProject={onDuplicateProject} onDuplicated={(project) => { setShowArchived(false); setSelectedId(project.id); }} />

            {!selected.archived ? (
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2 px-1">
                  <div><p className="text-xs font-semibold text-ink-300">새 Todo 마일스톤</p><p className="mt-0.5 text-[11px] text-ink-500">같은 마일스톤에 작업을 연속 추가할 때 선택을 유지합니다.</p></div>
                  <select className="field min-h-9 w-full py-1.5 text-xs sm:w-64" value={newTodoMilestoneId} onChange={(event) => setNewTodoMilestoneId(event.target.value)} aria-label="새 Todo 마일스톤">
                    <option value="">마일스톤 없음</option>{projectMilestones.map((milestone) => <option key={milestone.id} value={milestone.id}>{milestone.title}</option>)}
                  </select>
                </div>
                <TodoForm compact submitLabel="프로젝트 Todo 추가" categories={categories} projects={activeProjects} defaultProjectId={selected.id} onAdd={(input) => { void addProjectTodo(input); }} />
              </div>
            ) : null}

            <div className="grid gap-4 2xl:grid-cols-2">
              <section className="app-card p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2"><Target size={17} className="text-accent-300" /><h3 className="font-bold text-ink-100">마일스톤</h3></div>
                  {projectTodos.length ? <span className="text-[11px] text-ink-500">미지정 Todo {unassignedMilestoneTodos}개</span> : null}
                </div>
                {!selected.archived ? <form className="mb-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_10rem_auto]" onSubmit={createMilestone}><input className="field" value={milestoneTitle} onChange={(event) => setMilestoneTitle(event.target.value)} placeholder="마일스톤" /><input className="field" type="date" value={milestoneDate} onChange={(event) => setMilestoneDate(event.target.value)} /><button className="btn-secondary" type="submit" disabled={!milestoneTitle.trim()}><Plus size={15} />추가</button></form> : null}
                <div className="space-y-3">
                  {projectMilestones.length ? projectMilestones.map((milestone) => {
                    const milestoneTodos = projectTodos.filter((todo) => todo.milestoneId === milestone.id);
                    const milestoneCompleted = milestoneTodos.filter((todo) => todo.completed).length;
                    const milestoneProgress = milestoneTodos.length ? Math.round((milestoneCompleted / milestoneTodos.length) * 100) : 0;
                    return (
                      <div key={milestone.id} className="rounded-lg border border-ink-800/70 bg-ink-950/25 p-3">
                        <div className="flex items-start gap-2">
                          <button type="button" className="icon-btn h-9 w-9 shrink-0 rounded-md" onClick={() => void onUpdateMilestone(milestone.id, { status: milestone.status === "DONE" ? "TODO" : "DONE" })} aria-label="마일스톤 완료 토글">{milestone.status === "DONE" ? <CheckCircle2 size={16} className="text-emerald-300" /> : <CircleDot size={16} />}</button>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center justify-between gap-2"><p className={`min-w-0 truncate text-sm font-semibold ${milestone.status === "DONE" ? "text-ink-500 line-through" : "text-ink-100"}`}>{milestone.title}</p><span className="text-[11px] font-semibold text-ink-400">{milestoneCompleted}/{milestoneTodos.length} · {milestoneProgress}%</span></div>
                            <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-ink-500">{milestone.targetDate ? <span>목표일 {milestone.targetDate}</span> : null}<span>Todo {milestoneTodos.length}개</span></div>
                          </div>
                          <button type="button" className="icon-btn h-9 w-9 shrink-0 rounded-md hover:text-red-200" onClick={() => window.confirm("마일스톤을 삭제할까요? 연결된 Todo의 마일스톤 지정은 해제됩니다.") && void onDeleteMilestone(milestone.id)} aria-label="마일스톤 삭제"><Trash2 size={14} /></button>
                        </div>
                        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-ink-800"><div className="h-full rounded-full bg-accent-500 transition-all" style={{ width: `${milestoneProgress}%` }} /></div>
                        {milestoneTodos.length ? (
                          <div className="mt-3 space-y-1.5 border-t border-ink-800/70 pt-2.5">
                            {milestoneTodos.map((todo) => (
                              <div key={todo.id} className="flex min-w-0 items-center gap-2 rounded-md px-1.5 py-1 text-xs hover:bg-ink-900/45">
                                <button type="button" onClick={() => onToggleTodo(todo.id)} className={`h-3.5 w-3.5 shrink-0 rounded-full border ${todo.completed ? "border-success bg-success" : "border-ink-600"}`} aria-label={`${todo.title} 완료 토글`} />
                                <span className={`min-w-0 flex-1 truncate ${todo.completed ? "text-ink-500 line-through" : "text-ink-300"}`}>{todo.title}</span>
                                <span className="shrink-0 text-[10px] text-ink-600">{todo.workflowStatus}</span>
                              </div>
                            ))}
                          </div>
                        ) : <p className="mt-3 border-t border-ink-800/70 pt-2.5 text-xs text-ink-600">연결된 Todo가 없습니다.</p>}
                      </div>
                    );
                  }) : <p className="py-4 text-center text-sm text-ink-500">아직 마일스톤이 없습니다.</p>}
                </div>
              </section>

              <section className="app-card p-4">
                <div className="mb-3 flex items-center gap-2"><FileText size={17} className="text-accent-300" /><h3 className="font-bold text-ink-100">연결된 메모</h3></div>
                {linkedMemos.length ? <div className="space-y-2">{linkedMemos.map((memo) => <div key={memo.id} className="rounded-lg border border-ink-800/70 bg-ink-950/25 px-3 py-2"><p className="text-sm font-semibold text-ink-100">{memoTitle(memo)}</p><p className="mt-1 line-clamp-2 text-xs text-ink-500">{memo.content}</p></div>)}</div> : <p className="py-4 text-center text-sm text-ink-500">메모 화면에서 이 프로젝트를 연결하면 여기에 표시됩니다.</p>}
              </section>
            </div>

            <section className="app-card p-4">
              <div className="mb-3 flex items-center gap-2"><GitBranch size={17} className="text-accent-300" /><h3 className="font-bold text-ink-100">Decision Log</h3></div>
              {!selected.archived ? (
                <form className="mb-4 grid gap-2 lg:grid-cols-[10rem_minmax(0,1fr)_minmax(0,1fr)_9rem_auto]" onSubmit={createDecision}>
                  <input className="field" value={decisionTitle} onChange={(event) => setDecisionTitle(event.target.value)} placeholder="결정 제목" />
                  <input className="field" value={decisionText} onChange={(event) => setDecisionText(event.target.value)} placeholder="무엇을 결정했나" />
                  <input className="field" value={decisionRationale} onChange={(event) => setDecisionRationale(event.target.value)} placeholder="이유 / 트레이드오프" />
                  <input className="field" type="date" value={decisionDate} onChange={(event) => setDecisionDate(event.target.value)} />
                  <button className="btn-secondary" type="submit" disabled={!decisionTitle.trim() || !decisionText.trim()}><Plus size={15} />기록</button>
                </form>
              ) : null}
              <div className="space-y-2">
                {projectDecisions.length ? projectDecisions.map((decision) => (
                  <article key={decision.id} className="rounded-lg border border-ink-800/80 bg-ink-950/25 p-3">
                    <div className="flex items-start gap-3"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h4 className="font-bold text-ink-100">{decision.title}</h4><span className="text-[11px] text-ink-500">{decision.decidedAt}</span></div><p className="mt-2 text-sm text-ink-200">{decision.decision}</p>{decision.rationale ? <p className="mt-2 text-xs text-ink-500">근거: {decision.rationale}</p> : null}</div><button type="button" className="icon-btn h-9 w-9 rounded-md hover:text-red-200" onClick={() => window.confirm("이 의사결정 기록을 삭제할까요?") && void onDeleteDecision(decision.id)} aria-label="의사결정 기록 삭제"><Trash2 size={14} /></button></div>
                  </article>
                )) : <p className="py-4 text-center text-sm text-ink-500">아직 남긴 의사결정 기록이 없습니다.</p>}
              </div>
            </section>

            <section className="space-y-3">
              <div><h3 className="text-base font-bold text-ink-100">Kanban</h3><p className="mt-1 text-xs text-ink-500">상태와 마일스톤, 하위 작업을 한곳에서 조정합니다.</p></div>
              <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-4">
                {workflowColumns.map((column) => {
                  const items = projectTodos.filter((todo) => (todo.workflowStatus || (todo.completed ? "DONE" : "TODO")) === column.status);
                  return (
                    <div key={column.status} className="app-card min-h-44 p-3">
                      <div className="mb-3 flex items-center justify-between gap-2"><h4 className="text-sm font-bold text-ink-100">{column.label}</h4><span className="rounded-full border border-ink-800/70 bg-ink-950/45 px-2 py-0.5 text-xs text-ink-400">{items.length}</span></div>
                      <div className="space-y-2">
                        {items.map((todo) => {
                          const overdue = isOverdueByDeadline(todo, today);
                          const dueSoon = isDueSoon(todo, today);
                          const parent = projectTodos.find((item) => item.id === todo.parentTodoId);
                          const childCount = projectTodos.filter((item) => item.parentTodoId === todo.id).length;
                          const milestone = projectMilestones.find((item) => item.id === todo.milestoneId);
                          return (
                            <article key={todo.id} className="rounded-lg border border-ink-800/80 bg-ink-950/25 p-3">
                              <div className="flex items-start gap-2"><button type="button" onClick={() => onToggleTodo(todo.id)} className={`mt-0.5 h-4 w-4 shrink-0 rounded-full border ${todo.completed ? "border-success bg-success" : "border-ink-600"}`} aria-label="완료 토글" /><div className="min-w-0 flex-1">{parent ? <p className="mb-1 truncate text-[10px] font-semibold text-accent-300">↳ {parent.title}</p> : null}<p className={`break-words text-sm font-semibold ${todo.completed ? "text-ink-500 line-through" : "text-ink-100"}`}>{todo.title}</p><div className="mt-2 flex flex-wrap gap-1.5 text-[10px] text-ink-400">{milestone ? <span className="rounded border border-accent-500/25 bg-accent-500/[0.06] px-1.5 py-0.5 text-accent-200">{milestone.title}</span> : null}{childCount ? <span className="rounded border border-accent-500/25 bg-accent-500/[0.06] px-1.5 py-0.5 text-accent-200">하위 {childCount}</span> : null}{todo.estimateMinutes ? <span className="rounded border border-ink-800/70 bg-ink-900/60 px-1.5 py-0.5">{todo.estimateMinutes}분</span> : null}{todo.dueDate ? <span className={`rounded border px-1.5 py-0.5 ${overdue ? "border-danger/30 bg-danger/[0.07] text-red-100" : dueSoon ? "border-warning/30 bg-warning/[0.07] text-amber-100" : "border-ink-800/70 bg-ink-900/60"}`}>마감 {todo.dueDate}</span> : null}</div></div></div>
                              <div className="mt-2 grid gap-2">
                                <select className="field min-h-9 py-1 text-xs" value={todo.workflowStatus || (todo.completed ? "DONE" : "TODO")} onChange={(event) => void onUpdateTodo(todo.id, { workflowStatus: event.target.value as TodoWorkflowStatus, completed: event.target.value === "DONE" })}>{workflowColumns.map((target) => <option key={target.status} value={target.status}>{target.label}</option>)}</select>
                                <select className="field min-h-9 py-1 text-xs" value={todo.milestoneId || ""} onChange={(event) => void onUpdateTodo(todo.id, { projectId: selected.id, milestoneId: event.target.value || undefined })} disabled={selected.archived} aria-label={`${todo.title} 마일스톤`}>
                                  <option value="">마일스톤 없음</option>{projectMilestones.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
                                </select>
                              </div>
                              {!selected.archived ? <button type="button" className="mt-2 text-[11px] font-semibold text-ink-500 hover:text-accent-200" onClick={() => { setSubtaskParentId(subtaskParentId === todo.id ? "" : todo.id); setSubtaskTitle(""); }}><Plus size={12} className="mr-1 inline" />하위 Todo</button> : null}
                              {subtaskParentId === todo.id ? <div className="mt-2 flex gap-1.5"><input className="field min-h-9 py-1 text-xs" value={subtaskTitle} onChange={(event) => setSubtaskTitle(event.target.value)} placeholder="하위 작업" onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void createSubtask(todo); } }} /><button type="button" className="btn-secondary min-h-9 px-2 py-1 text-xs" onClick={() => void createSubtask(todo)} disabled={!subtaskTitle.trim()}>추가</button></div> : null}
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
          <div className="app-card flex min-h-64 items-center justify-center p-6 text-center"><div><PauseCircle className="mx-auto text-ink-600" /><p className="mt-3 text-sm font-semibold text-ink-400">프로젝트를 선택하거나 새로 만들어보세요.</p></div></div>
        )}
      </div>
    </div>
  );
}
