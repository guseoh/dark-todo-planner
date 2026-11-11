import { FormEvent, useEffect, useState } from "react";
import { addDays } from "date-fns";
import { ExternalLink } from "lucide-react";
import { parseDateKey, todayKey, toDateKey } from "../../lib/date";
import { resolveTodoScheduledDate } from "../../lib/todoScheduledDate";
import type { Category } from "../../types/category";
import type { Milestone, Project } from "../../types/project";
import type { Todo, TodoPlanningState, TodoPriority, TodoWorkflowStatus } from "../../types/todo";
import { Modal } from "../common/Modal";
import { TodoWorkflowPanel } from "./TodoWorkflowPanel";

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
  milestones?: Milestone[];
  subtasks?: Todo[];
  onAddSubtask?: (parent: Todo, title: string) => Promise<Todo | undefined> | Todo | undefined;
  onClose: () => void;
  onSave: (id: string, updates: Partial<Omit<Todo, "id" | "createdAt">>) => unknown | Promise<unknown>;
  presentation?: "modal" | "side-panel";
};

export function TodoEditModal({ todo, categories = [], projects = [], milestones = [], subtasks, onAddSubtask, onClose, onSave, presentation = "modal" }: TodoEditModalProps) {
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [blockReason, setBlockReason] = useState("");
  const [unblockCondition, setUnblockCondition] = useState("");
  const [priority, setPriority] = useState<TodoPriority>("MEDIUM");
  const [categoryId, setCategoryId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [milestoneId, setMilestoneId] = useState("");
  const [subtaskTitle, setSubtaskTitle] = useState("");
  const [subtaskBusy, setSubtaskBusy] = useState(false);
  const [subtaskError, setSubtaskError] = useState("");
  const [planningState, setPlanningState] = useState<TodoPlanningState>("SCHEDULED");
  const [workflowStatus, setWorkflowStatus] = useState<TodoWorkflowStatus>("TODO");
  const [referenceUrl, setReferenceUrl] = useState("");
  const [referenceLabel, setReferenceLabel] = useState("");
  const [referenceError, setReferenceError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!todo) return;
    setTitle(todo.title);
    setDate(todo.date === UNSCHEDULED_DATE ? "" : todo.date);
    setDueDate(todo.dueDate || "");
    setBlockReason(todo.blockReason || "");
    setUnblockCondition(todo.unblockCondition || "");
    setPriority(todo.priority);
    setCategoryId(todo.categoryId || "");
    setProjectId(todo.projectId || "");
    setMilestoneId(todo.milestoneId || "");
    setSubtaskTitle("");
    setSubtaskError("");
    setPlanningState(todo.planningState || "SCHEDULED");
    setWorkflowStatus(todo.completed ? "DONE" : (todo.workflowStatus && todo.workflowStatus !== "DONE" ? todo.workflowStatus : "TODO"));
    setReferenceUrl(todo.referenceUrl || "");
    setReferenceLabel(todo.referenceLabel || "");
    setReferenceError("");
    setSaving(false);
  }, [todo]);

  if (!todo) return null;
  const referenceHref = safeHttpHref(referenceUrl);

  const moveToDayOffset = (days: number) => {
    setPlanningState("SCHEDULED");
    setDate(toDateKey(addDays(parseDateKey(todayKey()), days)));
  };

  const addSubtask = async () => {
    if (!todo || !onAddSubtask || !subtaskTitle.trim() || subtaskBusy) return;
    setSubtaskBusy(true);
    setSubtaskError("");
    try {
      const added = await onAddSubtask(todo, subtaskTitle.trim());
      if (added) setSubtaskTitle("");
      else setSubtaskError("하위 작업 추가에 실패했습니다. 다시 시도해 주세요.");
    } catch {
      setSubtaskError("하위 작업 저장에 실패했습니다. 입력은 유지됩니다.");
    } finally {
      setSubtaskBusy(false);
    }
  };

  const saveTodo = async () => {
    if (!title.trim() || saving) return;
    setSaving(true);
    setReferenceError("");
    try {
      const saved = await Promise.resolve(onSave(todo.id, {
        title: title.trim(),
        categoryId: categoryId || undefined,
        projectId: projectId || undefined,
        ...(milestones.length ? { milestoneId: milestoneId || undefined } : {}),
        date: planningState === "SCHEDULED" ? resolveTodoScheduledDate(date, todo.date, todayKey()) : UNSCHEDULED_DATE,
        dueDate: dueDate || undefined,
        blockReason: blockReason.trim() || undefined,
        unblockCondition: unblockCondition.trim() || undefined,
        priority,
        completed: workflowStatus === "DONE",
        planningState,
        workflowStatus,
        referenceUrl: referenceUrl.trim() || undefined,
        referenceLabel: referenceUrl.trim() ? (referenceLabel.trim() || undefined) : undefined,
      }));
      if (!saved) {
        setReferenceError("Todo 저장에 실패했습니다. 입력 내용을 유지했으니 다시 시도해주세요.");
        return;
      }
      onClose();
    } catch (error) {
      setReferenceError(error instanceof Error ? error.message : "관련 링크를 저장하지 못했습니다.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="Todo 수정" description="일정, 프로젝트, 상태처럼 실제로 자주 바꾸는 항목만 관리합니다." onClose={onClose} size="lg" placement={presentation === "side-panel" ? "right" : "center"}>
      <form onSubmit={(event: FormEvent) => { event.preventDefault(); void saveTodo(); }}>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="space-y-1 text-sm text-ink-400 md:col-span-2">제목<input className="field" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Todo 제목" data-modal-initial-focus /></label>
          <label className="space-y-1 text-sm text-ink-400">보관 위치<select className="field" value={planningState} onChange={(event) => setPlanningState(event.target.value as TodoPlanningState)}>{planningState === "INBOX" ? <option value="INBOX" disabled>미계획 (기존 데이터)</option> : null}<option value="SCHEDULED">일정</option><option value="SOMEDAY">언젠가</option><option value="WAITING">대기</option></select></label>
          <label className="space-y-1 text-sm text-ink-400">작업 상태<select className="field" value={workflowStatus} onChange={(event) => setWorkflowStatus(event.target.value as TodoWorkflowStatus)} aria-describedby="todo-edit-status-help"><option value="TODO">할 일</option><option value="IN_PROGRESS">진행 중</option><option value="BLOCKED">차단됨</option><option value="DONE">완료</option></select><span id="todo-edit-status-help" className="block text-xs text-ink-500">완료를 고르면 Todo가 완료 처리됩니다.</span></label>
          {workflowStatus === "BLOCKED" || blockReason || unblockCondition ? (
            <div className="grid gap-3 rounded-lg border border-warning/25 bg-warning/[0.04] p-3 md:col-span-2 md:grid-cols-2">
              <label className="space-y-1 text-sm text-ink-300">차단 사유<textarea className="field min-h-20 resize-y" value={blockReason} onChange={(event) => setBlockReason(event.target.value)} maxLength={1000} placeholder="무엇 때문에 이 작업을 진행할 수 없나요?" /></label>
              <label className="space-y-1 text-sm text-ink-300">다시 진행할 조건<textarea className="field min-h-20 resize-y" value={unblockCondition} onChange={(event) => setUnblockCondition(event.target.value)} maxLength={1000} placeholder="어떤 일이 해결되면 다시 시작할 수 있나요?" /></label>
            </div>
          ) : null}
          {planningState === "SCHEDULED" ? <label className="space-y-1 text-sm text-ink-400">실행일<input className="field" type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label> : <div className="rounded-lg border border-ink-700/60 bg-ink-950/35 px-3 py-2 text-sm text-ink-500">일정으로 옮길 때 실행일을 지정합니다.</div>}
          <label className="space-y-1 text-sm text-ink-400">마감일<input className="field" type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} /></label>
          <div className="md:col-span-2">
            <p className="mb-1.5 text-xs font-semibold text-ink-500">빠른 일정 이동</p>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn-secondary min-h-9 px-3 py-1 text-xs" onClick={() => moveToDayOffset(0)}>오늘</button>
              <button type="button" className="btn-secondary min-h-9 px-3 py-1 text-xs" onClick={() => moveToDayOffset(1)}>내일</button>
              <button type="button" className="btn-secondary min-h-9 px-3 py-1 text-xs" onClick={() => moveToDayOffset(7)}>+1주</button>
              <button type="button" className="btn-secondary min-h-9 px-3 py-1 text-xs" onClick={() => { setPlanningState("SOMEDAY"); setDate(""); }}>언젠가</button>
            </div>
          </div>
          <label className="space-y-1 text-sm text-ink-400">카테고리<select className="field" value={categoryId} onChange={(event) => setCategoryId(event.target.value)}><option value="">미분류</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
          {projects.length || projectId ? <label className="space-y-1 text-sm text-ink-400">프로젝트<select className="field" value={projectId} onChange={(event) => setProjectId(event.target.value)}><option value="">프로젝트 없음</option>{projects.filter((project) => !project.archived || project.id === projectId).map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label> : null}
          {milestones.length && projectId ? <label className="space-y-1 text-sm text-ink-400">
            마일스톤
            <select className="field" value={milestoneId} onChange={(event) => setMilestoneId(event.target.value)}>
              <option value="">미지정</option>
              {milestones.filter((item) => item.projectId === projectId).map((item) =>
                <option key={item.id} value={item.id}>{item.title}</option>)}
            </select>
          </label> : null}
          <label className="space-y-1 text-sm text-ink-400">우선순위<select className="field" value={priority} onChange={(event) => setPriority(event.target.value as TodoPriority)}><option value="LOW">낮음</option><option value="MEDIUM">보통</option><option value="HIGH">높음</option></select></label>
          <div className="space-y-2 rounded-lg border border-ink-700/60 bg-ink-950/30 p-3 md:col-span-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div><p className="text-sm font-semibold text-ink-200">관련 링크</p><p className="mt-0.5 text-xs text-ink-500">GitHub·문서 등 이 Todo와 연결된 외부 자료를 바로 엽니다.</p></div>
              {referenceHref ? <a href={referenceHref} target="_blank" rel="noreferrer" className="btn-secondary min-h-8 px-2.5 py-1 text-xs"><ExternalLink size={13} />열기</a> : null}
            </div>
            <div className="grid gap-2 sm:grid-cols-[10rem_minmax(0,1fr)]">
              <input className="field" value={referenceLabel} onChange={(event) => setReferenceLabel(event.target.value)} placeholder="GitHub" aria-label="관련 링크 이름" />
              <input className="field" type="url" value={referenceUrl} onChange={(event) => { setReferenceUrl(event.target.value); setReferenceError(""); }} placeholder="https://..." aria-label="관련 링크 URL" />
            </div>
            {referenceError ? <p className="text-xs font-semibold text-danger" role="alert">{referenceError}</p> : null}
          </div>
          {subtasks ? <section className="md:col-span-2 border-t border-ui-divider pt-3" aria-label="하위 작업">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-ui-text">하위 작업</h3>
              <span className="text-xs text-ui-muted">{subtasks.length}개</span>
            </div>
            {subtasks.length ? <ul className="mt-2 space-y-1.5 text-xs text-ui-secondary">
              {subtasks.map((item) => <li key={item.id} className="flex items-center gap-2">
                <span className={item.completed ? "line-through opacity-60" : ""}>{item.title}</span>
              </li>)}
            </ul> : null}
            {onAddSubtask ? <div className="mt-3 flex gap-2">
              <input className="field min-w-0 flex-1" value={subtaskTitle}
                onChange={(event) => setSubtaskTitle(event.target.value)}
                placeholder="하위 작업 제목" aria-label="하위 작업 제목"
                onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void addSubtask(); } }} />
              <button type="button" className="btn-secondary" disabled={subtaskBusy || !subtaskTitle.trim()} onClick={() => void addSubtask()}>
                {subtaskBusy ? "추가 중" : "추가"}
              </button>
            </div> : null}
            {subtaskError ? <p role="alert" className="mt-1 text-xs text-danger">{subtaskError}</p> : null}
          </section> : null}
        </div>
        <TodoWorkflowPanel todo={todo} />
        <div className="mt-5 flex flex-col-reverse gap-2 border-t border-ink-700/60 pt-4 sm:flex-row sm:justify-end"><button type="button" className="btn-secondary" onClick={onClose} disabled={saving}>취소</button><button type="submit" className="btn-primary" disabled={!title.trim() || saving}>{saving ? "저장 중..." : "저장"}</button></div>
      </form>
    </Modal>
  );
}
