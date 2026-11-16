import { FormEvent, useState } from "react";
import { Trash2 } from "lucide-react";
import { ApiError } from "../../lib/api/client";
import { fromLocalInput, toLocalInput } from "../../lib/timeTracking";
import type { Category } from "../../types/category";
import type { TimeEntry, TimeEntryInput } from "../../types/timeTracking";
import { Modal } from "../common/Modal";

type Props = {
  /** Existing entry to edit, or undefined to add a manual one. */
  entry?: TimeEntry;
  categories: Category[];
  defaultStart: string;
  defaultEnd: string;
  onClose: () => void;
  onCreate: (input: TimeEntryInput) => Promise<void>;
  onUpdate: (id: string, input: Pick<TimeEntryInput, "startedAt" | "endedAt" | "title" | "categoryId">) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
};

/** Add or correct a measured interval — e.g. when the timer was left running or never started. */
export function TimeEntryModal({ entry, categories, defaultStart, defaultEnd, onClose, onCreate, onUpdate, onDelete }: Props) {
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
    const times = { startedAt: fromLocalInput(start), endedAt: fromLocalInput(end) };
    const name = title.trim();
    void run(() => entry
      ? onUpdate(entry.id, { ...times, title: name || undefined, categoryId: categoryId || null })
      : name ? onCreate({ ...times, title: name, categoryId: categoryId || null }) : Promise.reject(new ApiError("무엇을 했는지 입력하세요.", 400)));
  };

  return (
    <Modal title={entry ? "측정 기록 수정" : "측정 기록 추가"} description="하루는 새벽 3시에 바뀌므로 그 시각을 넘기는 기록은 둘로 나눠 입력하세요." onClose={onClose}>
      <form className="grid gap-3" onSubmit={submit}>
        <label className="grid gap-1 text-xs font-semibold text-ui-secondary">내용
          <input className="field" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={200} placeholder="예: 스프링 시큐리티 공부" autoFocus />
        </label>
        <label className="grid gap-1 text-xs font-semibold text-ui-secondary">카테고리
          <select className="field" value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
            <option value="">미분류</option>
            {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
          </select>
        </label>
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
