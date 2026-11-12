import { Modal } from "../components/common/Modal";
import { entityColors, getEntityColor } from "../lib/entityColor";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { Archive, ArchiveRestore, CheckCircle2, CircleDot, ExternalLink, MoreHorizontal, PauseCircle, Pencil, Plus, Save, Target, Trash2, X } from "lucide-react";
import { ProjectDecisionLog } from "../components/project/ProjectDecisionLog";
import { PageHeader } from "../components/common/PageHeader";
import { ProjectKanban } from "../components/project/ProjectKanban";
import { ProjectOverviewTools } from "../components/project/ProjectOverviewTools";
import type { ProjectDuplicateMode } from "../hooks/useProjects";
import type { Category } from "../types/category";
import type { Milestone, MilestoneInput, Project, ProjectDecision, ProjectDecisionInput, ProjectInput, ProjectResource, ProjectStatus } from "../types/project";
import type { Todo, TodoInput } from "../types/todo";

const projectStatusLabel: Record<ProjectStatus, string> = {
  PLANNING: "계획",
  ACTIVE: "진행 중",
  ON_HOLD: "보류",
  DONE: "완료",
};

const createResourceId = () => typeof crypto !== "undefined" && "randomUUID" in crypto
  ? crypto.randomUUID()
  : `resource-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const isHttpUrl = (value: string) => {
  try {
    const protocol = new URL(value).protocol;
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
};

type ProjectPageProps = {
  focusedProjectId?: string | null;
  onSearchTargetOpened?: () => void;
  projects: Project[];
  milestones: Milestone[];
  decisions: ProjectDecision[];
  todos: Todo[];
  categories: Category[];
  onAddProject: (input: ProjectInput) => Promise<Project | undefined> | Project | undefined;
  onUpdateProject: (id: string, input: Partial<ProjectInput>) => Promise<Project | undefined> | Project | undefined;
  onDeleteProject: (id: string) => Promise<boolean> | boolean;
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
  onDeleteTodo: (id: string) => void;
  onToggleTodo: (id: string) => void;
  onDetachTodo: (id: string, projectId: string, includeChildren: boolean) => Promise<boolean>;
  onOpenProjectTodos: (projectId: string) => void;
};

export function ProjectPage({
  focusedProjectId,
  onSearchTargetOpened,
  projects,
  milestones,
  decisions,
  todos,
  categories,
  onAddProject,
  onUpdateProject,
  onDeleteProject,
  onDuplicateProject,
  onArchiveProject,
  onUnarchiveProject,
  onAddMilestone,
  onUpdateMilestone,
  onDeleteMilestone,
  onAddDecision,
  onDeleteDecision,
  onAddTodo,
  onUpdateTodo,
  onToggleTodo,
  onDeleteTodo,
  onDetachTodo,
  onOpenProjectTodos,
}: ProjectPageProps) {
  const activeProjects = useMemo(() => projects.filter((project) => !project.archived), [projects]);
  const archivedProjects = useMemo(() => projects.filter((project) => project.archived), [projects]);
  const [showArchived, setShowArchived] = useState(false);
  const visibleProjects = showArchived ? archivedProjects : activeProjects;
  const [selectedId, setSelectedId] = useState("");
  const [showCreateProject, setShowCreateProject] = useState(false);
  const [newName, setNewName] = useState("");
  const [milestoneTitle, setMilestoneTitle] = useState("");
  const [milestoneDate, setMilestoneDate] = useState("");
  const [editingProject, setEditingProject] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [projectDescription, setProjectDescription] = useState("");
  const [projectStartDate, setProjectStartDate] = useState("");
  const [projectColor, setProjectColor] = useState("");
  const [resourceLabel, setResourceLabel] = useState("");
  const [resourceUrl, setResourceUrl] = useState("");
  const [resourceError, setResourceError] = useState("");
  const [deletingProject, setDeletingProject] = useState(false);
  const [projectDialog, setProjectDialog] = useState<"milestones" | "decisions" | "resources" | null>(null);

  useEffect(() => {
    const candidates = showArchived ? archivedProjects : activeProjects;
    if (!candidates.some((project) => project.id === selectedId)) setSelectedId(candidates[0]?.id || "");
  }, [activeProjects, archivedProjects, selectedId, showArchived]);

  useEffect(() => {
    if (!focusedProjectId) return;
    const project = projects.find((item) => item.id === focusedProjectId);
    if (!project) return;
    setShowArchived(project.archived);
    setSelectedId(project.id);
    onSearchTargetOpened?.();
  }, [focusedProjectId, projects, onSearchTargetOpened]);

  useEffect(() => {
    setProjectDialog(null);
    setEditingProject(false);
    setResourceLabel("");
    setResourceUrl("");
    setResourceError("");
  }, [selectedId]);

  const selected = projects.find((project) => project.id === selectedId);
  const projectTodos = useMemo(() => todos.filter((todo) => todo.projectId === selectedId && !todo.archived), [selectedId, todos]);
  const projectMilestones = useMemo(() => milestones.filter((milestone) => milestone.projectId === selectedId), [milestones, selectedId]);
  const projectDecisions = useMemo(() => decisions.filter((decision) => decision.projectId === selectedId), [decisions, selectedId]);
  const completed = projectTodos.filter((todo) => todo.completed).length;
  const [showDuplicate, setShowDuplicate] = useState(false);
  const progress = projectTodos.length ? Math.round((completed / projectTodos.length) * 100) : 0;
  const unassignedMilestoneTodos = projectTodos.filter((todo) => !todo.milestoneId).length;

  const createProject = async (event: FormEvent) => {
    event.preventDefault();
    if (!newName.trim()) return;

    const created = await onAddProject({
      name: newName.trim(),
      status: "ACTIVE",
      resources: [],
    });
    if (!created) return;

    setSelectedId(created.id);
    setNewName("");
    setShowCreateProject(false);
    setShowArchived(false);
  };

  const deleteSelectedProject = async () => {
    if (!selected || deletingProject) return;
    const confirmed = window.confirm(
      `"${selected.name}" 프로젝트를 삭제할까요?\n\n연결된 Todo는 유지되지만 프로젝트 연결이 해제됩니다. 마일스톤과 의사결정 기록은 함께 삭제되며 되돌릴 수 없습니다.`,
    );
    if (!confirmed) return;

    setDeletingProject(true);
    try {
      const deleted = await Promise.resolve(onDeleteProject(selected.id));
      if (deleted) setSelectedId("");
    } finally {
      setDeletingProject(false);
    }
  };

  const beginProjectEdit = () => {
    if (!selected) return;
    setProjectName(selected.name);
    setProjectDescription(selected.description || "");
    setProjectStartDate(selected.startDate || "");
    setProjectColor(selected.color || "");
    setEditingProject(true);
  };

  const saveProjectInfo = async (event: FormEvent) => {
    event.preventDefault();
    if (!selected || !projectName.trim()) return;

    const updated = await onUpdateProject(selected.id, {
      name: projectName.trim(),
      description: projectDescription.trim() || undefined,
      startDate: projectStartDate || undefined,
      color: projectColor,
    });
    if (updated) setEditingProject(false);
  };

  const addResource = async (event: FormEvent) => {
    event.preventDefault();
    if (!selected || selected.archived) return;

    const label = resourceLabel.trim();
    const url = resourceUrl.trim();
    if (!label) {
      setResourceError("링크 이름을 입력하세요.");
      return;
    }
    if (!isHttpUrl(url)) {
      setResourceError("http 또는 https 주소를 입력하세요.");
      return;
    }

    const resources = selected.resources || [];
    if (resources.length >= 12) {
      setResourceError("프로젝트 자료 링크는 최대 12개까지 등록할 수 있습니다.");
      return;
    }
    if (resources.some((resource) => resource.url === url)) {
      setResourceError("이미 등록된 주소입니다.");
      return;
    }

    const next: ProjectResource[] = [...resources, { id: createResourceId(), label, url }];
    const updated = await onUpdateProject(selected.id, { resources: next });
    if (!updated) return;

    setResourceLabel("");
    setResourceUrl("");
    setResourceError("");
  };

  const removeResource = async (resourceId: string) => {
    if (!selected || selected.archived) return;
    await onUpdateProject(selected.id, {
      resources: (selected.resources || []).filter((resource) => resource.id !== resourceId),
    });
  };

  const createMilestone = async (event: FormEvent) => {
    event.preventDefault();
    if (!selected || !milestoneTitle.trim()) return;

    const created = await onAddMilestone({
      projectId: selected.id,
      title: milestoneTitle.trim(),
      targetDate: milestoneDate || undefined,
    });
    if (!created) return;

    setMilestoneTitle("");
    setMilestoneDate("");
  };

  return (
    <div className="page-shell project-page">
      <PageHeader title="프로젝트"
        meta={`진행 ${activeProjects.length}개`}
        actions={<>

            {!showArchived ? (
              <button type="button" className="btn-secondary" onClick={() => setShowCreateProject((value) => !value)}>
                <Plus size={16} />{showCreateProject ? "추가 닫기" : "프로젝트 추가"}
              </button>
            ) : null}

        </>}
      />

      {showCreateProject && !showArchived ? (
        <form className="grid gap-2 border-b border-ui-divider py-4 sm:grid-cols-[minmax(0,1fr)_auto]" onSubmit={createProject}>
          <input className="field" value={newName} onChange={(event) => setNewName(event.target.value)} placeholder="새 프로젝트 이름" autoFocus />
          <button className="btn-secondary" type="submit" disabled={!newName.trim()}><Plus size={16} />추가</button>
        </form>
      ) : null}

      <div className="project-v4-workspace">
        <aside className="project-v4-switcher" aria-label="프로젝트 전환">
          <div className="project-v4-switcher__title">
            <span>프로젝트 목록</span>
            <span>{visibleProjects.length}</span>
          </div>
          {visibleProjects.length ? (
            <>
              <label className="project-v4-compact-select">
                <span className="sr-only">프로젝트 선택</span>
                <select className="field" aria-label="프로젝트 선택" value={selectedId} onChange={(event) => setSelectedId(event.target.value)}>
                  {visibleProjects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
                </select>
              </label>
              <nav className="project-v4-switcher__nav" aria-label={showArchived ? "보관 프로젝트 선택" : "진행 프로젝트 선택"}>
                {visibleProjects.map((project) => {
                  const tasks = todos.filter((todo) => todo.projectId === project.id && !todo.archived);
                  const done = tasks.filter((todo) => todo.completed).length;
                  return <button key={project.id} type="button" onClick={() => setSelectedId(project.id)}
                    aria-pressed={selectedId === project.id} aria-label={`${project.name} (${projectStatusLabel[project.status]})`}
                    className="project-v4-switcher__item">
                    <span className="project-v4-switcher__dot" style={{ backgroundColor: getEntityColor(project, projects) }} aria-hidden="true" />
                    <span className="truncate">{project.name}</span>
                    <span className="project-v4-switcher__status">{done}/{tasks.length}</span>
                    <span className="project-switcher-progress"><span style={{ width: tasks.length ? `${done / tasks.length * 100}%` : 0, background: getEntityColor(project, projects) }} /></span>
                  </button>;
                })}
              </nav>
            </>
          ) : <p className="project-v4-switcher__empty">{showArchived ? "보관된 프로젝트가 없습니다." : "프로젝트를 추가해 시작하세요."}</p>}
            <button type="button" className="btn-secondary" onClick={() => { setShowArchived((value) => !value); setShowCreateProject(false); }}>
              {showArchived ? <ArchiveRestore size={16} /> : <Archive size={16} />}
              {showArchived ? "진행 프로젝트" : `보관 ${archivedProjects.length}`}
            </button>
        </aside>
        <div className="project-v4-main min-w-0">
      {selected ? (
        <div className="project-detail min-w-0 space-y-3">
          <section className="project-overview py-3">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="project-v4-switcher__dot" style={{ backgroundColor: getEntityColor(selected, projects) }} aria-hidden="true" />
                  <h2 className="text-xl font-semibold tracking-tight text-ui-text">{selected.name}</h2>
                </div>
                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-ink-400">
                  <span><strong className="font-medium text-ui-text">{completed}/{projectTodos.length}개 완료</strong>{projectTodos.length > 0 ? ` · ${progress}%` : ""}</span>
                  {selected.startDate ? <span>시작일 {selected.startDate}</span> : null}
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <select aria-label="프로젝트 상태" className="field min-h-10 w-auto py-1.5 text-sm" value={selected.status} onChange={(event) => void onUpdateProject(selected.id, { status: event.target.value as ProjectStatus })} disabled={selected.archived || deletingProject}>
                  <option value="PLANNING">계획</option>
                  <option value="ACTIVE">진행 중</option>
                  <option value="ON_HOLD">보류</option>
                  <option value="DONE">완료</option>
                </select>
                <details className="project-actions-menu">
                  <summary className="btn-secondary" aria-label="프로젝트 관리 메뉴" title="프로젝트 관리 메뉴">
                    <MoreHorizontal size={17} aria-hidden="true" />
                  </summary>
                  <div className="project-actions-menu__panel" role="group" aria-label="프로젝트 관리" onClick={(event) => {
                    const menu = event.currentTarget.closest("details");
                    if (menu) menu.open = false;
                  }}>
                    {!selected.archived ? <button type="button" onClick={beginProjectEdit}><Pencil size={15} />정보 및 색상 수정</button> : null}
                    <button type="button" onClick={() => onOpenProjectTodos(selected.id)}>전체 Todo에서 보기</button>
                    <button type="button" onClick={() => setProjectDialog("resources")}>자료 링크</button>
                    <button type="button" onClick={() => setProjectDialog("milestones")}>마일스톤 관리</button>
                    {projectDecisions.length ? <button type="button" onClick={() => setProjectDialog("decisions")}>기존 결정 기록</button> : null}
                    <button type="button" onClick={() => setShowDuplicate(true)}>복제</button>
                    {selected.archived ? (
                      <button type="button" onClick={() => void onUnarchiveProject(selected.id)} disabled={deletingProject}>
                        <ArchiveRestore size={15} />복원
                      </button>
                    ) : (
                      <button type="button" onClick={() => void onArchiveProject(selected.id)} disabled={deletingProject}>
                        <Archive size={15} />보관
                      </button>
                    )}
                    <button type="button" className="project-actions-menu__danger" onClick={() => void deleteSelectedProject()} disabled={deletingProject}>
                      <Trash2 size={15} />{deletingProject ? "삭제 중" : "삭제"}
                    </button>
                  </div>
                </details>
              </div>
            </div>

            {editingProject ? (
              <form className="mt-4 grid gap-3 border-t border-ui-divider pt-4 lg:grid-cols-2" onSubmit={saveProjectInfo}>
                <label className="text-xs font-semibold text-ink-400">프로젝트 이름<input className="field mt-1.5" value={projectName} onChange={(event) => setProjectName(event.target.value)} maxLength={120} /></label>
                <fieldset className="text-xs font-semibold text-ink-400">
                  <legend>색상</legend>
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {entityColors.map((color, index) => (
                      <button type="button" key={color} aria-label={["파랑", "초록", "황갈색", "장밋빛", "보라", "청록"][index]}
                        aria-pressed={projectColor === color} onClick={() => setProjectColor(color)}
                        className="grid h-8 w-8 place-items-center rounded-md border border-ui-divider aria-pressed:border-ui-focus">
                        <span className="h-4 w-4 rounded-full" style={{ background: `var(--entity-${color})` }} />
                      </button>
                    ))}
                  </div>
                  <input className="field mt-1" aria-label="직접 색상 입력" placeholder="자동 색상" value={projectColor} onChange={(event) => setProjectColor(event.target.value)} maxLength={20} />
                </fieldset>
                <label className="text-xs font-semibold text-ink-400">시작일<input className="field mt-1.5" type="date" value={projectStartDate} onChange={(event) => setProjectStartDate(event.target.value)} /></label>
                <label className="text-xs font-semibold text-ink-400 lg:col-span-2">설명<textarea className="field mt-1.5 min-h-24 resize-y" value={projectDescription} onChange={(event) => setProjectDescription(event.target.value)} maxLength={1000} placeholder="프로젝트의 목표와 범위를 짧게 기록하세요." /></label>
                <div className="flex justify-end gap-2 lg:col-span-2">
                  <button type="button" className="btn-secondary" onClick={() => setEditingProject(false)}><X size={15} />취소</button>
                  <button type="submit" className="btn-secondary" disabled={!projectName.trim()}><Save size={15} />저장</button>
                </div>
              </form>
            ) : null}

            {projectTodos.length > 0 ? <div role="progressbar" aria-label="프로젝트 완료율" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress} className="project-overview__progress mt-4 h-1 overflow-hidden bg-ink-800">
              <div className="h-full" style={{ width: `${progress}%`, background: getEntityColor(selected, projects) }} />
            </div> : null}

          </section>
          {projectDialog === "resources" ? <Modal title="자료 링크" onClose={() => setProjectDialog(null)}>

              {(selected.resources || []).length ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {(selected.resources || []).map((resource) => (
                    <div key={resource.id} className="inline-flex max-w-full items-center rounded-md border border-ink-700/70 bg-ink-950/35">
                      <a className="inline-flex min-h-9 min-w-0 items-center gap-1.5 px-2.5 text-xs font-semibold text-ink-300 hover:text-accent-200" href={resource.url} target="_blank" rel="noreferrer" title={resource.url}>
                        <ExternalLink size={13} className="shrink-0" />
                        <span className="truncate">{resource.label}</span>
                      </a>
                      {!selected.archived ? <button type="button" className="flex h-9 w-8 shrink-0 items-center justify-center border-l border-ink-800 text-ink-600 hover:text-danger" onClick={() => void removeResource(resource.id)} aria-label={`${resource.label} 링크 삭제`}><X size={13} /></button> : null}
                    </div>
                  ))}
                </div>
              ) : <p className="mt-3 text-xs text-ink-500">자주 여는 저장소, 배포 주소, 문서를 연결해두면 프로젝트 화면에서 바로 이동할 수 있습니다.</p>}

              {!selected.archived ? (
                <form className="mt-3 grid gap-2 lg:grid-cols-[11rem_minmax(0,1fr)_auto]" onSubmit={addResource}>
                  <input className="field min-h-9 py-1.5 text-xs" value={resourceLabel} onChange={(event) => setResourceLabel(event.target.value)} placeholder="예: GitHub 저장소" maxLength={80} />
                  <input className="field min-h-9 py-1.5 text-xs" type="url" value={resourceUrl} onChange={(event) => { setResourceUrl(event.target.value); setResourceError(""); }} placeholder="https://..." maxLength={2048} />
                  <button type="submit" className="btn-secondary min-h-9 py-1.5 text-xs" disabled={!resourceLabel.trim() || !resourceUrl.trim()}><Plus size={14} />링크 추가</button>
                  {resourceError ? <p className="text-xs font-semibold text-danger lg:col-span-3">{resourceError}</p> : null}
                </form>
              ) : null}
          </Modal> : null}

          {showDuplicate ? <Modal title="프로젝트 복제" onClose={() => setShowDuplicate(false)}><ProjectOverviewTools duplicateOnly
            project={selected}
            todos={projectTodos}
            milestones={projectMilestones}
            onUpdateTodo={onUpdateTodo}
            onUpdateProject={onUpdateProject}
            onDuplicateProject={onDuplicateProject}
            onDuplicated={(project) => {
              setShowDuplicate(false);
              setShowArchived(false);
              setSelectedId(project.id);
            }}
          /></Modal> : null}

          {projectDialog === "milestones" ? <Modal title="마일스톤 관리" onClose={() => setProjectDialog(null)}><section className="py-2">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2"><Target size={17} className="text-accent-300" /><h3 className="font-bold text-ink-100">마일스톤</h3></div>
              {projectTodos.length ? <span className="text-xs text-ink-400">미지정 Todo {unassignedMilestoneTodos}개</span> : null}
            </div>

            {!selected.archived ? (
              <form className="mb-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_10rem_auto]" onSubmit={createMilestone}>
                <input className="field" value={milestoneTitle} onChange={(event) => setMilestoneTitle(event.target.value)} placeholder="마일스톤" />
                <input className="field" type="date" value={milestoneDate} onChange={(event) => setMilestoneDate(event.target.value)} />
                <button className="btn-secondary" type="submit" disabled={!milestoneTitle.trim()}><Plus size={15} />추가</button>
              </form>
            ) : null}

            <div className="space-y-3">
              {projectMilestones.length ? projectMilestones.map((milestone) => {
                const milestoneTodos = projectTodos.filter((todo) => todo.milestoneId === milestone.id);
                const milestoneCompleted = milestoneTodos.filter((todo) => todo.completed).length;
                const milestoneProgress = milestoneTodos.length ? Math.round((milestoneCompleted / milestoneTodos.length) * 100) : 0;
                return (
                  <div key={milestone.id} className="border-b border-ink-700/35 py-3">
                    <div className="flex items-start gap-2">
                      <button type="button" className="icon-btn h-9 w-9 shrink-0 rounded-md" onClick={() => void onUpdateMilestone(milestone.id, { status: milestone.status === "DONE" ? "TODO" : "DONE" })} aria-label="마일스톤 완료 토글">
                        {milestone.status === "DONE" ? <CheckCircle2 size={16} className="text-success" /> : <CircleDot size={16} />}
                      </button>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className={`min-w-0 truncate text-sm font-semibold ${milestone.status === "DONE" ? "text-ink-500 line-through" : "text-ink-100"}`}>{milestone.title}</p>
                          <span className="text-[11px] font-semibold text-ink-400">{milestoneCompleted}/{milestoneTodos.length} · {milestoneProgress}%</span>
                        </div>
                        <div className="mt-1 flex flex-wrap gap-2 text-xs text-ink-400">
                          {milestone.targetDate ? <span>일정 {milestone.targetDate}</span> : null}
                          <span>Todo {milestoneTodos.length}개</span>
                        </div>
                      </div>
                      <button type="button" className="icon-btn h-9 w-9 shrink-0 rounded-md hover:text-danger" onClick={() => window.confirm("마일스톤을 삭제할까요? 연결된 Todo의 마일스톤 지정은 해제됩니다.") && void onDeleteMilestone(milestone.id)} aria-label="마일스톤 삭제"><Trash2 size={14} /></button>
                    </div>

                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-ink-800">
                      <div className="h-full bg-accent-500 transition-[width]" style={{ width: `${milestoneProgress}%` }} />
                    </div>

                    {milestoneTodos.length ? (
                      <div className="mt-3 space-y-1.5 border-t border-ink-800/70 pt-2.5">
                        {milestoneTodos.map((todo) => (
                          <div key={todo.id} className="flex min-w-0 items-center gap-2 rounded-md px-1.5 py-1 text-xs hover:bg-ink-900/45">
                            <button type="button" onClick={() => onToggleTodo(todo.id)} className={`h-3.5 w-3.5 shrink-0 rounded-full border ${todo.completed ? "border-success bg-success" : "border-ink-600"}`} aria-label={`${todo.title} 완료 토글`} />
                            <span className={`min-w-0 flex-1 truncate ${todo.completed ? "text-ink-500 line-through" : "text-ink-300"}`}>{todo.title}</span>
                            <span className="shrink-0 text-xs text-ink-400">{todo.workflowStatus}</span>
                          </div>
                        ))}
                      </div>
                    ) : <p className="mt-3 border-t border-ink-800/70 pt-2.5 text-xs text-ink-600">연결된 Todo가 없습니다.</p>}
                  </div>
                );
              }) : <p className="py-4 text-center text-sm text-ink-500">아직 마일스톤이 없습니다.</p>}
            </div>
          </section></Modal> : null}

          {projectDialog === "decisions" ? <Modal title="기존 결정 기록" onClose={() => setProjectDialog(null)}><ProjectDecisionLog projectId={selected.id} archived decisions={projectDecisions} onAdd={onAddDecision} onDelete={onDeleteDecision} /></Modal> : null}
          <ProjectKanban key={selected.id} project={selected} todos={projectTodos} milestones={projectMilestones} categories={categories} projects={projects} onAddTodo={onAddTodo} onUpdateTodo={onUpdateTodo} onToggleTodo={onToggleTodo} onDeleteTodo={onDeleteTodo} onDetachTodo={onDetachTodo} />
        </div>
      ) : (
        <div className="app-card flex min-h-56 items-center justify-center p-6 text-center">
          <div>
            <PauseCircle className="mx-auto text-ink-600" />
            <p className="mt-3 text-sm font-semibold text-ink-400">프로젝트를 선택하거나 새로 만들어보세요.</p>
          </div>
        </div>
      )}
        </div>
      </div>
    </div>
  );
}
