import { FormEvent, useState } from "react";
import { Trash2 } from "lucide-react";
import { ApiError } from "../../lib/api/client";
import { fromLocalInput, toLocalInput } from "../../lib/timeTracking";
import type { Todo } from "../../types/todo";
import { useTodoQuickActions } from "../todo/TodoQuickActionsContext";
import type { Category } from "../../types/category";
import type { TimeEntry, TimeEntryInput } from "../../types/timeTracking";
import { Modal } from "../common/Modal";

type Props = {
  /** Existing entry to edit, or undefined to add a manual one. */
  entry?: TimeEntry;
  categories: Category[];
  todos?: Todo[];
  defaultStart: string;
  defaultEnd: string;
  onClose: () => void;
  onCreate: (input: TimeEntryInput) => Promise<void>;
  onUpdate: (id: string, input: Pick<TimeEntryInput, "startedAt" | "endedAt" | "title" | "categoryId">) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
};

/** Add or correct a measured interval — e.g. when the timer was left running or never started. */
export function TimeEntryModal({ entry, categories, todos = [], defaultStart, defaultEnd, onClose, onCreate, onUpdate, onDelete }: Props) {
  const projects = useTodoQuickActions()?.projects ?? [];
  const [target, setTarget] = useState("manual");
  const [targetId, setTargetId] = useState("");
  const [title, setTitle] = useState(entry?.title ?? "");
  const [categoryId, setCategoryId] = useState(entry?.categoryId ?? "");
  const [start, setStart] = useState(toLocalInput(entry?.startedAt ?? defaultStart));
  const [end, setEnd] = useState(toLocalInput(entry?.endedAt ?? defaultEnd));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const run = async (action: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await action();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "저장하지 못했습니다. 다시 시도해 주세요.");
    } finally {
      setBusy(false);
    }
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!start || !end) { setError("시작과 종료 시각을 입력하세요."); return; }
    if (!(Date.parse(end) > Date.parse(start))) { setError("종료 시각은 시작 시각보다 뒤여야 합니다."); return; }
    const times = { startedAt: fromLocalInput(start), endedAt: fromLocalInput(end) };
    const name = title.trim();
    if (entry) { void run(() => onUpdate(entry.id, { ...times, title: name || undefined, categoryId: categoryId || null })); return; }
    if (target === "todo") {
      if (!todos.some(todo => todo.id === targetId && !todo.archived)) { setError("Todo를 선택하세요."); return; }
      void run(() => onCreate({ ...times, todoId: targetId })); return;
    }
    if (target === "project") {
      if (!projects.some(project => project.id === targetId && !project.archived)) { setError("프로젝트를 선택하세요."); return; }
      void run(() => onCreate({ ...times, projectId: targetId, title: name || undefined, categoryId: categoryId || null })); return;
    }
    if (!name) { setError("무엇을 했는지 입력하세요."); return; }
    void run(() => onCreate({ ...times, title: name, categoryId: categoryId || null }));
  };

  return (
    <Modal title={entry ? "측정 기록 수정" : "측정 기록 추가"} description={entry ? "수정은 한 플래너 날짜 안에서만 가능합니다. 대상 연결은 유지됩니다." : "새벽 3시를 넘기는 새 기록은 날짜별로 분리됩니다."} onClose={busy ? () => undefined : onClose}>
      <form className="grid gap-3" onSubmit={submit}>
        {!entry ? <div className="grid gap-2">
          <label className="grid gap-1 text-xs font-semibold text-ui-secondary">측정 대상
            <select className="field" value={target} onChange={event => { setTarget(event.target.value); setTargetId(""); }}>
              <option value="manual">카테고리 또는 자유 기록</option>
              {todos.some(todo => !todo.archived) ? <option value="todo">Todo</option> : null}
              {projects.some(project => !project.archived) ? <option value="project">프로젝트</option> : null}
            </select>
          </label>
          {target !== "manual" ? <select className="field" aria-label="측정 대상 선택" value={targetId} onChange={event => setTargetId(event.target.value)} required>
            <option value="">대상 선택</option>
            {target === "todo" ? todos.filter(todo => !todo.archived).map(todo => <option key={todo.id} value={todo.id}>{todo.title}</option>)
              : projects.filter(project => !project.archived).map(project => <option key={project.id} value={project.id}>{project.name}</option>)}
          </select> : null}
        </div> : null}
        {entry || target !== "todo" ? <>
        <label className="grid gap-1 text-xs font-semibold text-ui-secondary">내용
          <input className="field" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={200} placeholder="예: 스프링 시큐리티 공부" autoFocus />
        </label>
        <label className="grid gap-1 text-xs font-semibold text-ui-secondary">카테고리
          <select className="field" value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
            <option value="">미분류</option>
            {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
          </select>
        </label>
        </> : <p className="text-xs text-ui-muted">선택한 Todo의 제목·프로젝트·카테고리로 기록합니다.</p>}
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-xs font-semibold text-ui-secondary">시작
            <input className="field" type="datetime-local" value={start} onChange={(event) => setStart(event.target.value)} required />
          </label>
          <label className="grid gap-1 text-xs font-semibold text-ui-secondary">종료
            <input className="field" type="datetime-local" value={end} onChange={(event) => setEnd(event.target.value)} required />
          </label>
        </div>
        {error ? <p role="alert" className="text-xs font-semibold text-danger">{error}</p> : null}
        <div className="flex flex-wrap items-center justify-between gap-2">
          {entry ? (
            <button type="button" className="btn-secondary text-danger" disabled={busy}
              onClick={() => { if (window.confirm("이 측정 기록을 삭제할까요?")) void run(() => onDelete(entry.id)); }}>
              <Trash2 size={14} />삭제
            </button>
          ) : <span />}
          <div className="flex gap-2">
            <button type="button" className="btn-secondary" onClick={onClose} disabled={busy}>취소</button>
            <button type="submit" className="btn-primary" disabled={busy}>{busy ? "저장 중" : "저장"}</button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
