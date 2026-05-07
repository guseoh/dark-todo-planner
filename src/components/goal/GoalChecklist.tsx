import { FormEvent, useState } from "react";
import { Check, CheckCircle2, Pencil, Plus, Trash2, X } from "lucide-react";
import type { Goal, GoalType } from "../../types/goal";

type GoalChecklistProps = {
  title: string;
  subtitle?: string;
  goals: Goal[];
  type: GoalType;
  addDefaults: Partial<Goal>;
  placeholder: string;
  emptyTitle: string;
  onAdd: (input: Partial<Goal> & { title: string }) => void;
  onUpdate: (id: string, updates: Partial<Omit<Goal, "id" | "createdAt">>) => void;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
};

export function GoalChecklist({
  title,
  subtitle,
  goals,
  type,
  addDefaults,
  placeholder,
  emptyTitle,
  onAdd,
  onUpdate,
  onToggle,
  onDelete,
}: GoalChecklistProps) {
  const [newTitle, setNewTitle] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const completedCount = goals.filter((goal) => goal.completed).length;
  const activeCount = goals.length - completedCount;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const titleValue = newTitle.trim();
    if (!titleValue) return;
    onAdd({
      ...addDefaults,
      title: titleValue,
      type,
      progress: 0,
      completed: false,
    });
    setNewTitle("");
  };

  const startEdit = (goal: Goal) => {
    setEditingId(goal.id);
    setEditingTitle(goal.title);
  };

  const saveEdit = (goal: Goal) => {
    const titleValue = editingTitle.trim();
    if (!titleValue) return;
    onUpdate(goal.id, { title: titleValue });
    setEditingId(null);
    setEditingTitle("");
  };

  return (
    <section className="app-card p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h3 className="text-base font-bold text-ink-100">{title}</h3>
          {subtitle ? <p className="mt-1 text-xs text-ink-500">{subtitle}</p> : null}
          <p className="mt-1 text-xs text-ink-500">
            전체 {goals.length}개 · 완료 {completedCount}개 · 미완료 {activeCount}개
          </p>
        </div>
        <form onSubmit={submit} className="flex w-full gap-2 sm:max-w-sm">
          <input
            className="field min-h-10 flex-1 py-1.5"
            value={newTitle}
            onChange={(event) => setNewTitle(event.target.value)}
            placeholder={placeholder}
          />
          <button type="submit" className="btn-primary min-h-10 px-3 py-1.5" disabled={!newTitle.trim()}>
            <Plus size={16} />
            추가
          </button>
        </form>
      </div>

      <div className="mt-3 space-y-2">
        {goals.length ? (
          goals.map((goal) => (
            <article key={goal.id} className={`rounded-lg border border-ink-700 bg-ink-950/45 px-3 py-2 ${goal.completed ? "opacity-65" : ""}`}>
              <div className="flex min-w-0 items-center gap-2">
                <button
                  type="button"
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                    goal.completed ? "border-success bg-success text-ink-950" : "border-ink-600 text-transparent hover:border-accent-400"
                  }`}
                  onClick={() => onToggle(goal.id)}
                  aria-pressed={goal.completed}
                  aria-label={`${goal.title} 완료 전환`}
                >
                  <CheckCircle2 size={13} />
                </button>

                {editingId === goal.id ? (
                  <input
                    className="field min-h-9 flex-1 py-1 text-sm"
                    value={editingTitle}
                    onChange={(event) => setEditingTitle(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") saveEdit(goal);
                      if (event.key === "Escape") setEditingId(null);
                    }}
                    autoFocus
                  />
                ) : (
                  <div className="min-w-0 flex-1">
                    <p className={`truncate text-sm font-semibold ${goal.completed ? "text-ink-500 line-through" : "text-ink-100"}`}>
                      {goal.title}
                    </p>
                    {goal.description ? <p className="mt-0.5 line-clamp-1 text-xs text-ink-500">{goal.description}</p> : null}
                  </div>
                )}

                {goal.completed && editingId !== goal.id ? (
                  <span className="hidden rounded-full border border-success/35 bg-success/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-100 sm:inline-flex">
                    완료
                  </span>
                ) : null}

                {editingId === goal.id ? (
                  <>
                    <button type="button" className="icon-btn min-h-8 min-w-8 rounded-md" onClick={() => saveEdit(goal)} aria-label="목표 수정 저장">
                      <Check size={14} />
                    </button>
                    <button type="button" className="icon-btn min-h-8 min-w-8 rounded-md" onClick={() => setEditingId(null)} aria-label="목표 수정 취소">
                      <X size={14} />
                    </button>
                  </>
                ) : (
                  <button type="button" className="icon-btn min-h-8 min-w-8 rounded-md" onClick={() => startEdit(goal)} aria-label="목표 수정">
                    <Pencil size={14} />
                  </button>
                )}
                <button
                  type="button"
                  className="icon-btn min-h-8 min-w-8 rounded-md hover:border-danger hover:text-red-100"
                  onClick={() => window.confirm("목표를 삭제할까요?") && onDelete(goal.id)}
                  aria-label="목표 삭제"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </article>
          ))
        ) : (
          <div className="rounded-lg border border-dashed border-ink-700 bg-ink-950/35 px-4 py-4 text-center">
            <p className="text-sm font-semibold text-ink-200">{emptyTitle}</p>
          </div>
        )}
      </div>
    </section>
  );
}
