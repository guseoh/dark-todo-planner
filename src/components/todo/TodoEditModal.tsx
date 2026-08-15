import { FormEvent, useEffect, useState } from "react";
import type { Category } from "../../types/category";
import type { Project } from "../../types/project";
import type { Todo, TodoPlanningState, TodoPriority, TodoRepeat, TodoWorkflowStatus } from "../../types/todo";
import { Modal } from "../common/Modal";
import { MarkdownEditor } from "../editor/MarkdownEditor";

const UNSCHEDULED_DATE = "9999-12-31";

type TodoEditModalProps = {
  todo: Todo | null;
  categories?: Category[];
  projects?: Project[];
  onClose: () => void;
  onSave: (id: string, updates: Partial<Omit<Todo, "id" | "createdAt">>) => void;
};

export function TodoEditModal({ todo, categories = [], projects = [], onClose, onSave }: TodoEditModalProps) {
  const [title, setTitle] = useState(""); const [memo, setMemo] = useState(""); const [date, setDate] = useState(""); const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState<TodoPriority>("MEDIUM"); const [repeat, setRepeat] = useState<TodoRepeat>("NONE"); const [tags, setTags] = useState("");
  const [completed, setCompleted] = useState(false); const [categoryId, setCategoryId] = useState(""); const [projectId, setProjectId] = useState("");
  const [planningState, setPlanningState] = useState<TodoPlanningState>("SCHEDULED"); const [workflowStatus, setWorkflowStatus] = useState<TodoWorkflowStatus>("TODO"); const [estimateMinutes, setEstimateMinutes] = useState("");

  useEffect(() => {
    if (!todo) return;
    setTitle(todo.title); setMemo(todo.memo || ""); setDate(todo.date === UNSCHEDULED_DATE ? "" : todo.date); setDueDate(todo.dueDate || ""); setPriority(todo.priority); setRepeat(todo.repeat || "NONE");
    setTags((todo.tags || []).join(", ")); setCompleted(todo.completed); setCategoryId(todo.categoryId || ""); setProjectId(todo.projectId || "");
    setPlanningState(todo.planningState || "SCHEDULED"); setWorkflowStatus(todo.workflowStatus || (todo.completed ? "DONE" : "TODO")); setEstimateMinutes(todo.estimateMinutes ? String(todo.estimateMinutes) : "");
  }, [todo]);

  if (!todo) return null;

  const saveTodo = () => {
    if (!title.trim()) return;
    onSave(todo.id, {
      title: title.trim(), categoryId: categoryId || undefined, projectId: projectId || undefined, memo,
      date: planningState === "SCHEDULED" ? (date || todo.date || new Date().toISOString().slice(0, 10)) : UNSCHEDULED_DATE,
      dueDate: dueDate || undefined, priority, repeat, tags: tags.split(","), completed, planningState,
      workflowStatus: completed ? "DONE" : workflowStatus, estimateMinutes: estimateMinutes ? Number(estimateMinutes) : undefined, updatedAt: new Date().toISOString(),
    });
    onClose();
  };

  return (
    <Modal title="Todo 수정" description="실행일과 마감일, 프로젝트, 상태와 예상 시간을 함께 관리합니다." onClose={onClose} size="lg">
      <form onSubmit={(event: FormEvent) => { event.preventDefault(); saveTodo(); }}>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="space-y-1 text-sm text-ink-400 md:col-span-2">제목<input className="field" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Todo 제목" data-modal-initial-focus /></label>
          <label className="space-y-1 text-sm text-ink-400">보관 위치<select className="field" value={planningState} onChange={(event) => setPlanningState(event.target.value as TodoPlanningState)}><option value="SCHEDULED">일정</option><option value="INBOX">Inbox</option><option value="SOMEDAY">Someday</option><option value="WAITING">Waiting</option></select></label>
          <label className="space-y-1 text-sm text-ink-400">작업 상태<select className="field" value={workflowStatus} onChange={(event) => setWorkflowStatus(event.target.value as TodoWorkflowStatus)} disabled={completed}><option value="TODO">Todo</option><option value="IN_PROGRESS">진행 중</option><option value="BLOCKED">Blocked</option><option value="DONE">완료</option></select></label>
          {planningState === "SCHEDULED" ? <label className="space-y-1 text-sm text-ink-400">실행일<input className="field" type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label> : <div className="rounded-lg border border-ink-700/60 bg-ink-950/35 px-3 py-2 text-sm text-ink-500">일정으로 옮길 때 실행일을 지정합니다.</div>}
          <label className="space-y-1 text-sm text-ink-400">마감일<input className="field" type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} /></label>
          <label className="space-y-1 text-sm text-ink-400">카테고리<select className="field" value={categoryId} onChange={(event) => setCategoryId(event.target.value)}><option value="">미분류</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
          {projects.length || projectId ? <label className="space-y-1 text-sm text-ink-400">프로젝트<select className="field" value={projectId} onChange={(event) => setProjectId(event.target.value)}><option value="">프로젝트 없음</option>{projects.filter((project) => !project.archived || project.id === projectId).map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label> : null}
          <label className="space-y-1 text-sm text-ink-400">예상 시간(분)<input className="field" type="number" min="1" max="1440" value={estimateMinutes} onChange={(event) => setEstimateMinutes(event.target.value)} placeholder="30" /></label>
          <label className="space-y-1 text-sm text-ink-400">우선순위<select className="field" value={priority} onChange={(event) => setPriority(event.target.value as TodoPriority)}><option value="LOW">낮음</option><option value="MEDIUM">보통</option><option value="HIGH">높음</option></select></label>
          <label className="space-y-1 text-sm text-ink-400">반복<select className="field" value={repeat} onChange={(event) => setRepeat(event.target.value as TodoRepeat)}><option value="NONE">반복 없음</option><option value="DAILY">매일</option><option value="WEEKLY">매주</option><option value="MONTHLY">매월</option><option value="WEEKDAY">평일만</option><option value="WEEKEND">주말만</option></select></label>
          <label className="space-y-1 text-sm text-ink-400">태그<input className="field" value={tags} onChange={(event) => setTags(event.target.value)} placeholder="공부, 개발, 운동" /></label>
          <label className="flex min-h-11 items-center gap-3 rounded-lg bg-ink-950/45 px-3 text-sm text-ink-300 md:col-span-2"><input type="checkbox" checked={completed} onChange={(event) => setCompleted(event.target.checked)} className="h-4 w-4 accent-accent-500" />완료된 Todo로 표시</label>
          <MarkdownEditor className="md:col-span-2" label="메모" value={memo} onChange={setMemo} placeholder="메모" />
        </div>
        <div className="mt-5 flex flex-col-reverse gap-2 border-t border-ink-700/60 pt-4 sm:flex-row sm:justify-end"><button type="button" className="btn-secondary" onClick={onClose}>취소</button><button type="submit" className="btn-primary" disabled={!title.trim()}>저장</button></div>
      </form>
    </Modal>
  );
}
