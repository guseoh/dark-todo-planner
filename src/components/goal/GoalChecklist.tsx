import { FormEvent, useRef, useState } from "react";
import { Check, CheckCircle2, Pencil, Plus, Trash2, X } from "lucide-react";
import type { Goal, GoalType } from "../../types/goal";

type GoalChecklistProps = {
  title: string;
  goals: Goal[];
  type: GoalType;
  addDefaults: Partial<Goal>;
  placeholder: string;
  emptyTitle: string;
  onAdd: (input: Partial<Goal> & { title: string }) => Promise<Goal | undefined>;
  onUpdate: (id: string, updates: Partial<Omit<Goal, "id" | "createdAt">>) => Promise<Goal | undefined>;
  onToggle: (id: string) => Promise<boolean>;
  onDelete: (id: string) => Promise<boolean>;
};

export function GoalChecklist({
  title, goals, type, addDefaults, placeholder, emptyTitle,
  onAdd, onUpdate, onToggle, onDelete,
}: GoalChecklistProps) {
  const [newTitle, setNewTitle] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [error, setError] = useState("");
  const completedCount = goals.filter((goal) => goal.completed).length;

  const execute = async (action: () => Promise<unknown>, failureMessage: string) => {
    if (busyRef.current) return false;
    busyRef.current = true;
    setBusy(true);
    setError("");
    try {
      if (!await action()) {
        setError(failureMessage);
        return false;
      }
      return true;
    } catch {
      setError(failureMessage);
      return false;
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = newTitle.trim();
    if (!value || busyRef.current) return;
    if (await execute(
      () => onAdd({ ...addDefaults, title: value, type, progress: 0, completed: false }),
      "목표를 추가하지 못했습니다. 내용을 유지했으니 다시 시도해 주세요.",
    )) setNewTitle("");
  };

  const startEdit = (goal: Goal) => {
    if (busyRef.current) return;
    setError("");
    setEditingId(goal.id);
    setEditingTitle(goal.title);
  };

  const saveEdit = async (goal: Goal) => {
    const value = editingTitle.trim();
    if (!value || busyRef.current) return;
    if (value === goal.title || await execute(
      () => onUpdate(goal.id, { title: value }),
      "목표 수정에 실패했습니다. 수정한 내용은 유지됩니다.",
    )) {
      setEditingId(null);
      setEditingTitle("");
    }
  };

  const toggle = async (goal: Goal) => {
    await execute(() => onToggle(goal.id), "목표 완료 상태를 변경하지 못했습니다. 다시 시도해 주세요.");
  };

  const remove = async (goal: Goal) => {
    if (busyRef.current || !window.confirm("목표를 삭제할까요?")) return;
    await execute(() => onDelete(goal.id), "목표를 삭제하지 못했습니다. 다시 시도해 주세요.");
  };

  return (
    <section className="app-card px-3.5 py-3" aria-label={title} aria-busy={busy}>
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          <h3 className="text-sm font-bold text-ink-100">{title}</h3>
          <span className="text-xs text-ink-400">{completedCount}/{goals.length} 완료</span>
        </div>
        <form onSubmit={(event) => { void submit(event); }} className="flex w-full min-w-0 gap-2 sm:w-auto sm:flex-1 sm:max-w-md">
          <input
            className="field min-h-10 min-w-0 flex-1 py-1.5"
            value={newTitle}
            onChange={(event) => setNewTitle(event.target.value)}
            placeholder={placeholder}
            aria-label={placeholder}
            maxLength={240}
          />
          <button type="submit" className="btn-primary min-h-10 shrink-0 px-3 py-1.5" disabled={!newTitle.trim() || busy}>
            <Plus size={16} />{busy ? "처리 중" : "추가"}
          </button>
        </form>
      </div>

      {error ? <p role="alert" className="mt-2 text-xs font-semibold text-red-200">{error}</p> : null}

      {goals.length ? (
        <div className="mt-3 space-y-1.5">
          {goals.map((goal) => (
            <article key={goal.id} className={`rounded-md border border-ink-700/70 bg-ink-950/30 px-3 py-2 ${goal.completed ? "opacity-75" : ""}`}>
              <div className="flex min-w-0 items-center gap-2">
                <button type="button"
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border ${goal.completed ? "border-success bg-success text-ink-950" : "border-ink-600 text-ink-400 hover:border-accent-400"}`}
                  onClick={() => { void toggle(goal); }}
                  disabled={busy}
                  aria-pressed={goal.completed} aria-label={`${goal.title} 완료 전환`}>
                  <CheckCircle2 size={15} />
                </button>
                {editingId === goal.id ? (
                  <input
                    className="field min-h-9 min-w-0 flex-1 py-1 text-sm"
                    value={editingTitle}
                    onChange={(event) => setEditingTitle(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") { event.preventDefault(); void saveEdit(goal); }
                      if (event.key === "Escape" && !busyRef.current) setEditingId(null);
                    }}
                    aria-label="목표 제목 수정"
                    maxLength={240}
                    disabled={busy}
                    autoFocus
                  />
                ) : (
                  <div className="min-w-0 flex-1">
                    <p className={`break-words text-sm font-semibold ${goal.completed ? "text-ink-400 line-through" : "text-ink-100"}`}>{goal.title}</p>
                    {goal.description ? <p className="mt-0.5 line-clamp-1 text-xs text-ink-400">{goal.description}</p> : null}
                  </div>
                )}
                {editingId === goal.id ? (
                  <>
                    <button type="button" className="icon-btn min-h-9 min-w-9" onClick={() => { void saveEdit(goal); }} aria-label="목표 수정 저장" disabled={busy || !editingTitle.trim()}><Check size={16} /></button>
                    <button type="button" className="icon-btn min-h-9 min-w-9" onClick={() => setEditingId(null)} aria-label="목표 수정 취소" disabled={busy}><X size={16} /></button>
                  </>
                ) : (
                  <button type="button" className="icon-btn min-h-9 min-w-9" onClick={() => startEdit(goal)} aria-label={`${goal.title} 수정`} disabled={busy}><Pencil size={15} /></button>
                )}
                <button type="button" className="icon-btn min-h-9 min-w-9 hover:border-danger hover:text-red-100"
                  onClick={() => { void remove(goal); }}
                  aria-label={`${goal.title} 삭제`} disabled={busy}><Trash2 size={15} /></button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <p className="mt-2 text-xs text-ink-500">{emptyTitle} 위 입력창에서 새 목표를 추가할 수 있습니다.</p>
      )}
    </section>
  );
}
