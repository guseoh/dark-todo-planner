import { FormEvent, useEffect, useMemo, useState } from "react";
import { addDays } from "date-fns";
import { ExternalLink } from "lucide-react";
import { api, apiAllPages, jsonBody } from "../../lib/api/client";
import { parseDateKey, todayKey, toDateKey } from "../../lib/date";
import type { Category } from "../../types/category";
import type { Project } from "../../types/project";
import type { Todo, TodoPlanningState, TodoPriority, TodoRepeat, TodoWorkflowStatus } from "../../types/todo";
import { Modal } from "../common/Modal";
import { MarkdownEditor } from "../editor/MarkdownEditor";
import { TodoReminderEditor } from "./TodoReminderEditor";

const UNSCHEDULED_DATE = "9999-12-31";
const safeHttpHref = (value: string) => {
  try {
    const url = new URL(value.trim());
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : "";
  } catch {
    return "";
  }
};

type TodoEditModalProps = {
  todo: Todo | null;
  categories?: Category[];
  projects?: Project[];
  onClose: () => void;
  onSave: (id: string, updates: Partial<Omit<Todo, "id" | "createdAt">>) => unknown | Promise<unknown>;
};

type Blocker = { id: string; title: string; completed: boolean; workflowStatus: string };

export function TodoEditModal({ todo, categories = [], projects = [], onClose, onSave }: TodoEditModalProps) {
  const [title, setTitle] = useState(""); const [memo, setMemo] = useState(""); const [date, setDate] = useState(""); const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState<TodoPriority>("MEDIUM"); const [repeat, setRepeat] = useState<TodoRepeat>("NONE"); const [tags, setTags] = useState("");
  const [completed, setCompleted] = useState(false); const [categoryId, setCategoryId] = useState(""); const [projectId, setProjectId] = useState("");
  const [planningState, setPlanningState] = useState<TodoPlanningState>("SCHEDULED"); const [workflowStatus, setWorkflowStatus] = useState<TodoWorkflowStatus>("TODO"); const [estimateMinutes, setEstimateMinutes] = useState("");
  const [referenceUrl, setReferenceUrl] = useState(""); const [referenceLabel, setReferenceLabel] = useState(""); const [referenceError, setReferenceError] = useState(""); const [saving, setSaving] = useState(false);
  const [blockingTodoIds, setBlockingTodoIds] = useState<string[]>([]); const [initialBlockingTodoIds, setInitialBlockingTodoIds] = useState<string[]>([]);
  const [candidateTodos, setCandidateTodos] = useState<Todo[]>([]); const [blockerSearch, setBlockerSearch] = useState(""); const [dependencyLoading, setDependencyLoading] = useState(false); const [dependencyError, setDependencyError] = useState("");

  useEffect(() => {
    if (!todo) return;
    setTitle(todo.title); setMemo(todo.memo || ""); setDate(todo.date === UNSCHEDULED_DATE ? "" : todo.date); setDueDate(todo.dueDate || ""); setPriority(todo.priority); setRepeat(todo.repeat || "NONE");
    setTags((todo.tags || []).join(", ")); setCompleted(todo.completed); setCategoryId(todo.categoryId || ""); setProjectId(todo.projectId || "");
    setPlanningState(todo.planningState || "SCHEDULED"); setWorkflowStatus(todo.workflowStatus || (todo.completed ? "DONE" : "TODO")); setEstimateMinutes(todo.estimateMinutes ? String(todo.estimateMinutes) : "");
    setReferenceUrl(todo.referenceUrl || ""); setReferenceLabel(todo.referenceLabel || ""); setReferenceError(""); setSaving(false); setBlockerSearch(""); setDependencyError("");

    let active = true;
    setDependencyLoading(true);
    void Promise.all([
      api<{ blockingTodoIds: string[]; blockers: Blocker[] }>(`/api/todos/${todo.id}/dependencies`),
      apiAllPages<Todo>("/api/todos?archived=false", "todos"),
    ]).then(([dependencyResult, todos]) => {
      if (!active) return;
      setBlockingTodoIds(dependencyResult.blockingTodoIds);
      setInitialBlockingTodoIds(dependencyResult.blockingTodoIds);
      setCandidateTodos(todos.filter((entry) => entry.id !== todo.id && !entry.archived));
    }).catch((error) => {
      if (active) setDependencyError(error instanceof Error ? error.message : "Todo 의존 관계를 불러오지 못했습니다.");
    }).finally(() => { if (active) setDependencyLoading(false); });
    return () => { active = false; };
  }, [todo]);

  const visibleCandidates = useMemo(() => {
    const keyword = blockerSearch.trim().toLowerCase();
    const sorted = [...candidateTodos].sort((a, b) => Number(a.completed) - Number(b.completed) || b.updatedAt.localeCompare(a.updatedAt));
    return (keyword ? sorted.filter((entry) => entry.title.toLowerCase().includes(keyword)) : sorted).slice(0, 30);
  }, [blockerSearch, candidateTodos]);

  if (!todo) return null;
  const referenceHref = safeHttpHref(referenceUrl);

  const moveToDayOffset = (days: number) => {
    setPlanningState("SCHEDULED");
    setDate(toDateKey(addDays(parseDateKey(todayKey()), days)));
  };

  const toggleBlocker = (id: string) => {
    setBlockingTodoIds((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]);
    setDependencyError("");
  };

  const saveTodo = async () => {
    if (!title.trim() || saving || dependencyLoading) return;
    setSaving(true);
    setReferenceError(""); setDependencyError("");
    try {
      const dependencyResult = await api<{ blockers: Blocker[]; workflowStatus: TodoWorkflowStatus }>(`/api/todos/${todo.id}/dependencies`, {
        method: "PUT",
        ...jsonBody({ blockingTodoIds }),
      });
      await api(`/api/todos/${todo.id}/reference-link`, {
        method: "PUT",
        ...jsonBody({ url: referenceUrl.trim() || null, label: referenceLabel.trim() || null }),
      });
      const hasUnresolvedBlocker = dependencyResult.blockers.some((blocker) => !blocker.completed && blocker.workflowStatus !== "DONE");
      const dependencyManagedBlocked = workflowStatus === "BLOCKED" && (blockingTodoIds.length > 0 || initialBlockingTodoIds.length > 0);
      const effectiveWorkflowStatus: TodoWorkflowStatus = completed
        ? "DONE"
        : hasUnresolvedBlocker
          ? "BLOCKED"
          : dependencyManagedBlocked
            ? "TODO"
            : workflowStatus;
      await Promise.resolve(onSave(todo.id, {
        title: title.trim(), categoryId: categoryId || undefined, projectId: projectId || undefined, memo,
        date: planningState === "SCHEDULED" ? (date || todo.date || todayKey()) : UNSCHEDULED_DATE,
        dueDate: dueDate || undefined, priority, repeat, tags: tags.split(","), completed, planningState,
        workflowStatus: effectiveWorkflowStatus, estimateMinutes: estimateMinutes ? Number(estimateMinutes) : undefined, blockingTodoIds, updatedAt: new Date().toISOString(),
      }));
      onClose();
    } catch (error) {
      setDependencyError(error instanceof Error ? error.message : "Todo를 저장하지 못했습니다.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="Todo 수정" description="실행일과 마감일, 프로젝트, 상태와 예상 시간을 함께 관리합니다." onClose={onClose} size="lg">
      <form onSubmit={(event: FormEvent) => { event.preventDefault(); void saveTodo(); }}>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="space-y-1 text-sm text-ink-400 md:col-span-2">제목<input className="field" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Todo 제목" data-modal-initial-focus /></label>
          <label className="space-y-1 text-sm text-ink-400">보관 위치<select className="field" value={planningState} onChange={(event) => setPlanningState(event.target.value as TodoPlanningState)}><option value="SCHEDULED">일정</option><option value="INBOX">Inbox</option><option value="SOMEDAY">Someday</option><option value="WAITING">Waiting</option></select></label>
          <label className="space-y-1 text-sm text-ink-400">작업 상태<select className="field" value={workflowStatus} onChange={(event) => setWorkflowStatus(event.target.value as TodoWorkflowStatus)} disabled={completed}><option value="TODO">Todo</option><option value="IN_PROGRESS">진행 중</option><option value="BLOCKED">Blocked</option><option value="DONE">완료</option></select></label>
          {planningState === "SCHEDULED" ? <label className="space-y-1 text-sm text-ink-400">실행일<input className="field" type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label> : <div className="rounded-lg border border-ink-700/60 bg-ink-950/35 px-3 py-2 text-sm text-ink-500">일정으로 옮길 때 실행일을 지정합니다.</div>}
          <label className="space-y-1 text-sm text-ink-400">마감일<input className="field" type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} /></label>
          <div className="md:col-span-2">
            <p className="mb-1.5 text-xs font-semibold text-ink-500">빠른 일정 이동</p>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn-secondary min-h-9 px-3 py-1 text-xs" onClick={() => moveToDayOffset(0)}>오늘</button>
              <button type="button" className="btn-secondary min-h-9 px-3 py-1 text-xs" onClick={() => moveToDayOffset(1)}>내일</button>
              <button type="button" className="btn-secondary min-h-9 px-3 py-1 text-xs" onClick={() => moveToDayOffset(7)}>+1주</button>
              <button type="button" className="btn-secondary min-h-9 px-3 py-1 text-xs" onClick={() => { setPlanningState("SOMEDAY"); setDate(""); }}>Someday</button>
            </div>
          </div>
          <label className="space-y-1 text-sm text-ink-400">카테고리<select className="field" value={categoryId} onChange={(event) => setCategoryId(event.target.value)}><option value="">미분류</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
          {projects.length || projectId ? <label className="space-y-1 text-sm text-ink-400">프로젝트<select className="field" value={projectId} onChange={(event) => setProjectId(event.target.value)}><option value="">프로젝트 없음</option>{projects.filter((project) => !project.archived || project.id === projectId).map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label> : null}
          <label className="space-y-1 text-sm text-ink-400">예상 시간(분)<input className="field" type="number" min="1" max="1440" value={estimateMinutes} onChange={(event) => setEstimateMinutes(event.target.value)} placeholder="30" /></label>
          <label className="space-y-1 text-sm text-ink-400">우선순위<select className="field" value={priority} onChange={(event) => setPriority(event.target.value as TodoPriority)}><option value="LOW">낮음</option><option value="MEDIUM">보통</option><option value="HIGH">높음</option></select></label>
          <label className="space-y-1 text-sm text-ink-400">반복<select className="field" value={repeat} onChange={(event) => setRepeat(event.target.value as TodoRepeat)}><option value="NONE">반복 없음</option><option value="DAILY">매일</option><option value="WEEKLY">매주</option><option value="MONTHLY">매월</option><option value="WEEKDAY">평일만</option><option value="WEEKEND">주말만</option></select></label>
          <label className="space-y-1 text-sm text-ink-400">태그<input className="field" value={tags} onChange={(event) => setTags(event.target.value)} placeholder="공부, 개발, 운동" /></label>

          <section className="space-y-2 rounded-lg border border-ink-700/60 bg-ink-950/30 p-3 md:col-span-2" aria-labelledby="todo-dependency-title">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div><p id="todo-dependency-title" className="text-sm font-semibold text-ink-200">막고 있는 Todo</p><p className="mt-0.5 text-xs text-ink-500">선택한 Todo가 끝나기 전까지 이 Todo는 Blocked로 유지됩니다. 순환 의존성은 저장할 수 없습니다.</p></div>
              {blockingTodoIds.length ? <span className="rounded-full border border-amber-400/25 bg-amber-400/10 px-2 py-0.5 text-[11px] font-semibold text-amber-200">{blockingTodoIds.length}개 연결</span> : null}
            </div>
            <input className="field" value={blockerSearch} onChange={(event) => setBlockerSearch(event.target.value)} placeholder="Todo 제목 검색" aria-label="의존 Todo 검색" disabled={dependencyLoading} />
            <div className="max-h-40 space-y-1 overflow-y-auto rounded-md border border-ink-800/70 bg-ink-950/35 p-1.5">
              {dependencyLoading ? <p className="px-2 py-3 text-xs text-ink-500">Todo 관계를 불러오는 중...</p> : visibleCandidates.length ? visibleCandidates.map((entry) => (
                <label key={entry.id} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-ink-800/70">
                  <input type="checkbox" checked={blockingTodoIds.includes(entry.id)} onChange={() => toggleBlocker(entry.id)} className="h-4 w-4 accent-accent-500" />
                  <span className={`min-w-0 flex-1 truncate ${entry.completed ? "text-ink-500 line-through" : "text-ink-300"}`}>{entry.title}</span>
                  <span className="shrink-0 text-[10px] text-ink-600">{entry.completed ? "완료" : entry.workflowStatus === "BLOCKED" ? "Blocked" : "미완료"}</span>
                </label>
              )) : <p className="px-2 py-3 text-xs text-ink-500">조건에 맞는 Todo가 없습니다.</p>}
            </div>
            {dependencyError ? <p className="text-xs font-semibold text-red-200" role="alert">{dependencyError}</p> : null}
          </section>

          <div className="space-y-2 rounded-lg border border-ink-700/60 bg-ink-950/30 p-3 md:col-span-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div><p className="text-sm font-semibold text-ink-200">관련 링크</p><p className="mt-0.5 text-xs text-ink-500">Notion·GitHub·문서 등 이 Todo와 연결된 외부 자료를 바로 엽니다.</p></div>
              {referenceHref ? <a href={referenceHref} target="_blank" rel="noreferrer" className="btn-secondary min-h-8 px-2.5 py-1 text-xs"><ExternalLink size={13} />열기</a> : null}
            </div>
            <div className="grid gap-2 sm:grid-cols-[10rem_minmax(0,1fr)]">
              <input className="field" value={referenceLabel} onChange={(event) => setReferenceLabel(event.target.value)} placeholder="Notion" aria-label="관련 링크 이름" />
              <input className="field" type="url" value={referenceUrl} onChange={(event) => { setReferenceUrl(event.target.value); setReferenceError(""); }} placeholder="https://..." aria-label="관련 링크 URL" />
            </div>
            {referenceError ? <p className="text-xs font-semibold text-red-200" role="alert">{referenceError}</p> : null}
          </div>
          <TodoReminderEditor todoId={todo.id} />
          <label className="flex min-h-11 items-center gap-3 rounded-lg bg-ink-950/45 px-3 text-sm text-ink-300 md:col-span-2"><input type="checkbox" checked={completed} onChange={(event) => setCompleted(event.target.checked)} className="h-4 w-4 accent-accent-500" />완료된 Todo로 표시</label>
          <MarkdownEditor className="md:col-span-2" label="메모" value={memo} onChange={setMemo} placeholder="메모" />
        </div>
        <div className="mt-5 flex flex-col-reverse gap-2 border-t border-ink-700/60 pt-4 sm:flex-row sm:justify-end"><button type="button" className="btn-secondary" onClick={onClose} disabled={saving}>취소</button><button type="submit" className="btn-primary" disabled={!title.trim() || saving || dependencyLoading}>{saving ? "저장 중..." : "저장"}</button></div>
      </form>
    </Modal>
  );
}
