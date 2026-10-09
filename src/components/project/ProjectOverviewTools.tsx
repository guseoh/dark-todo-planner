import { useEffect, useMemo, useState } from "react";
import { Activity, AlertCircle, ArrowDown, ArrowUp, CalendarPlus, Clock3, Copy, ListTodo, Search } from "lucide-react";
import { todayKey } from "../../lib/date";
import { isOverdueByDeadline } from "../../lib/todo";
import { planningStateLabels } from "../../lib/todoLabels";
import type { ProjectDuplicateMode } from "../../hooks/useProjects";
import type { Milestone, Project } from "../../types/project";
import type { Todo } from "../../types/todo";

const priorityRank = { HIGH: 0, MEDIUM: 1, LOW: 2 } as const;
const planningLabel = planningStateLabels;
const BACKLOG_ORDER_KEY = "dark-todo-planner:project-backlog-order";

const readBacklogOrder = (): Record<string, string[]> => {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(BACKLOG_ORDER_KEY) || "{}");
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.fromEntries(Object.entries(parsed).filter((entry): entry is [string, string[]] => Array.isArray(entry[1]) && entry[1].every((id) => typeof id === "string")));
  } catch {
    return {};
  }
};

const sortBacklog = (a: Todo, b: Todo) => {
  const priority = priorityRank[a.priority] - priorityRank[b.priority];
  if (priority) return priority;
  const dueA = a.dueDate || "9999-12-31";
  const dueB = b.dueDate || "9999-12-31";
  if (dueA !== dueB) return dueA.localeCompare(dueB);
  if (a.date !== b.date) return a.date.localeCompare(b.date);
  return (a.order ?? 0) - (b.order ?? 0);
};

type ProjectOverviewToolsProps = {
  project: Project;
  todos: Todo[];
  milestones: Milestone[];
  onUpdateTodo: (id: string, input: Partial<Omit<Todo, "id" | "createdAt">>) => Promise<Todo | undefined> | Todo | undefined;
  onUpdateProject: (id: string, input: Partial<Omit<Project, "id" | "createdAt">>) => Promise<Project | undefined> | Project | undefined;
  onDuplicateProject: (id: string, input: { name: string; mode: ProjectDuplicateMode }) => Promise<Project | undefined> | Project | undefined;
  onDuplicated: (project: Project) => void;
};

export function ProjectOverviewTools({ project, todos, milestones, onUpdateTodo, onUpdateProject, onDuplicateProject, onDuplicated }: ProjectOverviewToolsProps) {
  const incomplete = useMemo(() => todos.filter((todo) => !todo.completed), [todos]);
  const backlog = useMemo(() => incomplete.filter((todo) => todo.workflowStatus === "TODO").sort(sortBacklog), [incomplete]);
  const progress = todos.length ? Math.round(((todos.length - incomplete.length) / todos.length) * 100) : 0;
  const today = todayKey();
  const overdueCount = incomplete.filter((todo) => isOverdueByDeadline(todo, today)).length;
  const blockedCount = incomplete.filter((todo) => todo.workflowStatus === "BLOCKED").length;
  const staleCount = incomplete.filter((todo) => todo.workflowStatus === "IN_PROGRESS" && Number.isFinite(Date.parse(todo.updatedAt)) && Date.now() - Date.parse(todo.updatedAt) >= 7 * 24 * 60 * 60 * 1000).length;
  const nextMilestone = useMemo(() => milestones.filter((milestone) => milestone.status !== "DONE").sort((a, b) =>
    (a.targetDate || "9999-12-31").localeCompare(b.targetDate || "9999-12-31") || a.order - b.order,
  )[0], [milestones]);
  const openMilestoneCount = milestones.filter((milestone) => milestone.status !== "DONE").length;
  const canComplete = todos.length > 0 && incomplete.length === 0 && openMilestoneCount === 0 && project.status !== "DONE";

  const [showDuplicate, setShowDuplicate] = useState(false);
  const [backlogQuery, setBacklogQuery] = useState("");
  const [backlogPriority, setBacklogPriority] = useState<"ALL" | Todo["priority"]>("ALL");
  const [backlogSort, setBacklogSort] = useState<"PRIORITY" | "DUE" | "MANUAL">("PRIORITY");
  const [manualBacklogOrder, setManualBacklogOrder] = useState<Record<string, string[]>>(readBacklogOrder);
  const [completingProject, setCompletingProject] = useState(false);
  const [completionError, setCompletionError] = useState("");
  const [duplicateName, setDuplicateName] = useState(`${project.name} 복사본`);
  const [duplicateMode, setDuplicateMode] = useState<ProjectDuplicateMode>("STRUCTURE");
  const [duplicateError, setDuplicateError] = useState("");
  const [duplicating, setDuplicating] = useState(false);

  useEffect(() => {
    setShowDuplicate(false);
    setDuplicateName(`${project.name} 복사본`);
    setDuplicateMode("STRUCTURE");
    setDuplicateError("");
  }, [project.id, project.name]);

  useEffect(() => {
    try { localStorage.setItem(BACKLOG_ORDER_KEY, JSON.stringify(manualBacklogOrder)); } catch { /* Backlog remains usable without browser storage. */ }
  }, [manualBacklogOrder]);

  const duplicate = async () => {
    if (!duplicateName.trim() || duplicating) return;
    setDuplicating(true);
    setDuplicateError("");
    try {
      const created = await Promise.resolve(onDuplicateProject(project.id, { name: duplicateName.trim(), mode: duplicateMode }));
      if (!created) { setDuplicateError("프로젝트를 복제하지 못했습니다."); return; }
      setShowDuplicate(false);
      onDuplicated(created);
    } catch (error) {
      setDuplicateError(error instanceof Error ? error.message : "프로젝트를 복제하지 못했습니다.");
    } finally {
      setDuplicating(false);
    }
  };

  const orderedBacklog = useMemo(() => {
    if (backlogSort !== "MANUAL") return [...backlog].sort((a, b) => backlogSort === "DUE"
      ? (a.dueDate || "9999-12-31").localeCompare(b.dueDate || "9999-12-31") || priorityRank[a.priority] - priorityRank[b.priority] || a.title.localeCompare(b.title, "ko")
      : sortBacklog(a, b));
    const ids = manualBacklogOrder[project.id] || [];
    const order = new Map(ids.map((id, index) => [id, index]));
    return [...backlog].sort((a, b) => (order.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (order.get(b.id) ?? Number.MAX_SAFE_INTEGER) || sortBacklog(a, b));
  }, [backlog, backlogSort, manualBacklogOrder, project.id]);
  const visibleBacklog = orderedBacklog.filter((todo) =>
    (!backlogQuery || todo.title.toLocaleLowerCase().includes(backlogQuery.trim().toLocaleLowerCase())) &&
    (backlogPriority === "ALL" || todo.priority === backlogPriority),
  );

  const moveBacklogItem = (todoId: string, direction: -1 | 1) => {
    const currentIds = orderedBacklog.map((todo) => todo.id);
    const index = currentIds.indexOf(todoId);
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= currentIds.length) return;
    [currentIds[index], currentIds[nextIndex]] = [currentIds[nextIndex], currentIds[index]];
    setManualBacklogOrder((current) => ({ ...current, [project.id]: currentIds }));
  };

  const completeProject = async () => {
    if (!canComplete || completingProject) return;
    setCompletingProject(true);
    setCompletionError("");
    try {
      const updated = await Promise.resolve(onUpdateProject(project.id, { status: "DONE" }));
      if (!updated) setCompletionError("프로젝트 상태를 완료로 바꾸지 못했습니다.");
    } catch (error) {
      setCompletionError(error instanceof Error ? error.message : "프로젝트 상태를 완료로 바꾸지 못했습니다.");
    } finally {
      setCompletingProject(false);
    }
  };

  return (
    <div className="space-y-4">
      <section className="app-card p-4">
        <div className="flex items-center gap-2">
          <Activity size={17} className="text-accent-300" />
          <div>
            <h3 className="font-bold text-ink-100">프로젝트 상태</h3>
            <p className="mt-0.5 text-xs text-ink-500">진행률과 남은 작업만 간단히 확인합니다.</p>
          </div>
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <Metric label="진행률" value={`${progress}%`} detail={`${todos.length - incomplete.length}/${todos.length} 완료`} icon={<Activity size={15} />} />
          <Metric label="남은 Todo" value={`${incomplete.length}`} detail="미완료 작업" icon={<ListTodo size={15} />} />
          <Metric label="마감 초과" value={`${overdueCount}`} detail="기한이 지난 미완료 작업" icon={<Clock3 size={15} />} />
          <Metric label="진행 확인" value={`${blockedCount + staleCount}`} detail={`${blockedCount}개 막힘 · ${staleCount}개 7일 이상 정체`} icon={<AlertCircle size={15} />} />
        </div>
        {nextMilestone ? <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-ink-800/75 bg-ink-950/25 px-3 py-2.5">
          <div className="min-w-0"><p className="text-[11px] font-semibold uppercase tracking-wide text-ink-500">다음 마일스톤</p><p className="mt-0.5 truncate text-sm font-semibold text-ink-200">{nextMilestone.title}</p></div>
          <span className={`shrink-0 text-xs ${nextMilestone.targetDate && nextMilestone.targetDate < today ? "text-red-200" : "text-ink-400"}`}>{nextMilestone.targetDate ? `목표 ${nextMilestone.targetDate}` : "목표일 미설정"}</span>
        </div> : null}
        {todos.length > 0 && incomplete.length === 0 && project.status !== "DONE" ? <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-success/25 bg-success/[0.04] px-3 py-2.5">
          <p className="text-xs text-ink-300">{openMilestoneCount ? `Todo는 모두 완료했지만 마일스톤 ${openMilestoneCount}개가 남아 있습니다.` : "Todo와 마일스톤이 모두 완료됐습니다. 프로젝트를 완료로 표시할까요?"}</p>
          {canComplete ? <button type="button" className="btn-secondary min-h-8 px-2.5 py-1 text-xs" onClick={() => void completeProject()} disabled={completingProject}>{completingProject ? "변경 중..." : "프로젝트 완료"}</button> : null}
          {completionError ? <p className="basis-full text-xs text-red-200" role="alert">{completionError}</p> : null}
        </div> : null}
      </section>

      <section className="app-card p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2"><ListTodo size={17} className="text-accent-300" /><h3 className="font-bold text-ink-100">시작 전 작업</h3></div>
          <span className="text-xs text-ink-500">{backlog.length}개</span>
        </div>
        <p className="mt-1 text-xs text-ink-500">시작 전 작업을 검색하고 우선순위로 좁혀 오늘 실행할 항목을 고릅니다.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <label className="relative min-w-48 flex-1"><Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-500" /><input className="field min-h-9 py-1 pl-9 text-xs" value={backlogQuery} onChange={(event) => setBacklogQuery(event.target.value)} placeholder="시작 전 작업 검색" aria-label="시작 전 작업 검색" /></label>
          <select className="field min-h-9 w-36 py-1 text-xs" value={backlogPriority} onChange={(event) => setBacklogPriority(event.target.value as typeof backlogPriority)} aria-label="백로그 우선순위 필터"><option value="ALL">모든 우선순위</option><option value="HIGH">높음</option><option value="MEDIUM">보통</option><option value="LOW">낮음</option></select>
          <select className="field min-h-9 w-36 py-1 text-xs" value={backlogSort} onChange={(event) => setBacklogSort(event.target.value as typeof backlogSort)} aria-label="백로그 정렬"><option value="PRIORITY">우선순위 순</option><option value="DUE">마감일 순</option><option value="MANUAL">직접 정렬</option></select>
        </div>
        <div className="mt-3 space-y-2">
          {visibleBacklog.length ? visibleBacklog.slice(0, 12).map((todo) => (
            <div key={todo.id} className="flex items-center gap-2 rounded-lg border border-ink-800/70 bg-ink-950/25 px-3 py-2">
              <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-ink-200">{todo.title}</p><p className="mt-0.5 text-[11px] text-ink-500">{todo.priority === "HIGH" ? "높음" : todo.priority === "LOW" ? "낮음" : "보통"} · {planningLabel[todo.planningState]}{todo.dueDate ? ` · 마감 ${todo.dueDate}` : ""}</p></div>
              {!project.archived ? <>{backlogSort === "MANUAL" ? <div className="flex shrink-0"><button type="button" className="icon-btn h-8 w-8" onClick={() => moveBacklogItem(todo.id, -1)} disabled={orderedBacklog[0]?.id === todo.id} aria-label={`${todo.title} 위로 이동`}><ArrowUp size={13} /></button><button type="button" className="icon-btn h-8 w-8" onClick={() => moveBacklogItem(todo.id, 1)} disabled={orderedBacklog[orderedBacklog.length - 1]?.id === todo.id} aria-label={`${todo.title} 아래로 이동`}><ArrowDown size={13} /></button></div> : null}<button type="button" className="btn-secondary min-h-8 shrink-0 px-2 py-1 text-[11px]" onClick={() => void onUpdateTodo(todo.id, { planningState: "SCHEDULED", date: today, workflowStatus: "TODO", completed: false })} aria-label={`${todo.title} 오늘 실행할 작업으로 지정`}><CalendarPlus size={13} />오늘로</button><button type="button" className="btn-secondary min-h-8 shrink-0 px-2 py-1 text-[11px]" onClick={() => void onUpdateTodo(todo.id, { workflowStatus: "IN_PROGRESS", completed: false })}>시작</button></> : null}
            </div>
          )) : <p className="rounded-lg border border-dashed border-ink-800 px-3 py-5 text-center text-xs text-ink-600">조건에 맞는 시작 전 작업이 없습니다.</p>}
          {visibleBacklog.length > 12 ? <p className="text-right text-[11px] text-ink-600">외 {visibleBacklog.length - 12}개</p> : null}
        </div>
      </section>

      <section className="app-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2"><Copy size={17} className="text-accent-300" /><div><h3 className="font-bold text-ink-100">프로젝트 복제</h3><p className="mt-0.5 text-xs text-ink-500">반복되는 개인 프로젝트 구조를 템플릿처럼 다시 사용합니다.</p></div></div>
          <button type="button" className="btn-secondary" onClick={() => setShowDuplicate((value) => !value)}><Copy size={15} />{showDuplicate ? "닫기" : "복제"}</button>
        </div>
        {showDuplicate ? (
          <div className="mt-4 grid gap-3 rounded-lg border border-ink-800/80 bg-ink-950/25 p-3 lg:grid-cols-[minmax(0,1fr)_13rem_auto] lg:items-end">
            <label className="text-xs font-semibold text-ink-400">새 프로젝트 이름<input className="field mt-1.5" value={duplicateName} onChange={(event) => setDuplicateName(event.target.value)} maxLength={120} /></label>
            <label className="text-xs font-semibold text-ink-400">복제 범위<select className="field mt-1.5" value={duplicateMode} onChange={(event) => setDuplicateMode(event.target.value as ProjectDuplicateMode)}><option value="STRUCTURE">구조만 복제</option><option value="WITH_TODOS">Todo까지 복제</option></select></label>
            <button type="button" className="btn-primary min-h-10" onClick={() => void duplicate()} disabled={!duplicateName.trim() || duplicating}>{duplicating ? "복제 중..." : "새 프로젝트 만들기"}</button>
            <p className="text-[11px] text-ink-500 lg:col-span-3">구조 복제는 설명·색상·자료 링크·마일스톤을 복사합니다. Todo 포함 복제는 활성 Todo의 기본 정보와 구조를 복사하고 일정과 완료 상태는 초기화해 받은함에 넣습니다.</p>
            {duplicateError ? <p className="text-xs font-semibold text-red-200 lg:col-span-3" role="alert">{duplicateError}</p> : null}
          </div>
        ) : null}
      </section>
    </div>
  );
}

function Metric({ label, value, detail, icon }: { label: string; value: string; detail: string; icon: JSX.Element }) {
  return (
    <div className="rounded-lg border border-ink-800/75 bg-ink-950/25 px-3 py-3">
      <div className="flex items-center gap-1.5 text-[11px] font-semibold text-ink-500">{icon}<span>{label}</span></div>
      <p className="mt-2 break-words text-base font-bold text-ink-100">{value}</p>
      <p className="mt-1 text-[10px] text-ink-600">{detail}</p>
    </div>
  );
}
