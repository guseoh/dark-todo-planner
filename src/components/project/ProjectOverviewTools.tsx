import { useEffect, useMemo, useState } from "react";
import { Activity, Copy, ListTodo } from "lucide-react";
import type { ProjectDuplicateMode } from "../../hooks/useProjects";
import type { Project } from "../../types/project";
import type { Todo } from "../../types/todo";

const priorityRank = { HIGH: 0, MEDIUM: 1, LOW: 2 } as const;
const planningLabel = { SCHEDULED: "일정", INBOX: "Inbox", SOMEDAY: "Someday", WAITING: "Waiting" } as const;

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
  onUpdateTodo: (id: string, input: Partial<Omit<Todo, "id" | "createdAt">>) => Promise<Todo | undefined> | Todo | undefined;
  onDuplicateProject: (id: string, input: { name: string; mode: ProjectDuplicateMode }) => Promise<Project | undefined> | Project | undefined;
  onDuplicated: (project: Project) => void;
};

export function ProjectOverviewTools({ project, todos, onUpdateTodo, onDuplicateProject, onDuplicated }: ProjectOverviewToolsProps) {
  const incomplete = useMemo(() => todos.filter((todo) => !todo.completed), [todos]);
  const backlog = useMemo(() => incomplete.filter((todo) => todo.workflowStatus === "TODO").sort(sortBacklog), [incomplete]);
  const progress = todos.length ? Math.round(((todos.length - incomplete.length) / todos.length) * 100) : 0;

  const [showDuplicate, setShowDuplicate] = useState(false);
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
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <Metric label="진행률" value={`${progress}%`} detail={`${todos.length - incomplete.length}/${todos.length} 완료`} icon={<Activity size={15} />} />
          <Metric label="남은 Todo" value={`${incomplete.length}`} detail="미완료 작업" icon={<ListTodo size={15} />} />
        </div>
      </section>

      <section className="app-card p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2"><ListTodo size={17} className="text-accent-300" /><h3 className="font-bold text-ink-100">Backlog</h3></div>
          <span className="text-xs text-ink-500">{backlog.length}개</span>
        </div>
        <p className="mt-1 text-xs text-ink-500">아직 시작하지 않은 Todo를 우선순위와 마감일 순으로 보여줍니다.</p>
        <div className="mt-3 space-y-2">
          {backlog.length ? backlog.slice(0, 8).map((todo) => (
            <div key={todo.id} className="flex items-center gap-2 rounded-lg border border-ink-800/70 bg-ink-950/25 px-3 py-2">
              <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-ink-200">{todo.title}</p><p className="mt-0.5 text-[11px] text-ink-500">{todo.priority} · {planningLabel[todo.planningState]}{todo.dueDate ? ` · 마감 ${todo.dueDate}` : ""}</p></div>
              {!project.archived ? <button type="button" className="btn-secondary min-h-8 shrink-0 px-2 py-1 text-[11px]" onClick={() => void onUpdateTodo(todo.id, { workflowStatus: "IN_PROGRESS", completed: false })}>진행 시작</button> : null}
            </div>
          )) : <p className="rounded-lg border border-dashed border-ink-800 px-3 py-5 text-center text-xs text-ink-600">Backlog가 비어 있습니다.</p>}
          {backlog.length > 8 ? <p className="text-right text-[11px] text-ink-600">외 {backlog.length - 8}개 · 전체 내용은 아래 Kanban에서 관리합니다.</p> : null}
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
            <p className="text-[11px] text-ink-500 lg:col-span-3">구조 복제는 설명·색상·자료 링크·마일스톤을 복사합니다. Todo 포함 복제는 활성 Todo의 기본 정보와 구조를 복사하고 일정과 완료 상태는 초기화해 Inbox에 넣습니다.</p>
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
