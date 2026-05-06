import { CheckCircle2, Trash2 } from "lucide-react";
import { formatKoreanDate, getDdayLabel } from "../../lib/date";
import type { Goal } from "../../types/goal";
import { ProgressBar } from "../common/ProgressBar";

export function GoalCard({
  goal,
  onUpdate,
  onToggle,
  onDelete,
}: {
  goal: Goal;
  onUpdate: (id: string, updates: Partial<Omit<Goal, "id" | "createdAt">>) => void;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const displayProgress = Math.min(100, Math.max(0, goal.completed ? 100 : goal.progress));

  return (
    <article className={`app-card p-4 ${goal.completed ? "opacity-60" : ""}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className={`break-words text-base font-bold text-ink-100 ${goal.completed ? "line-through" : ""}`}>{goal.title}</h3>
            <span className="rounded-full border border-warning/45 bg-warning/15 px-2.5 py-1 text-xs font-bold text-amber-100">
              {getDdayLabel(goal.dueDate || goal.targetDate || goal.weekEndDate || `${goal.month || ""}-01`)}
            </span>
            <span className="rounded-full border border-accent-500/35 bg-accent-500/15 px-2.5 py-1 text-xs font-bold text-indigo-100">
              {displayProgress}%
            </span>
          </div>
          {goal.description ? <p className="mt-2 text-sm text-ink-400">{goal.description}</p> : null}
          <p className="mt-2 text-xs text-ink-500">기간 {goal.weekStartDate && goal.weekEndDate ? `${goal.weekStartDate} ~ ${goal.weekEndDate}` : goal.month || formatKoreanDate(goal.dueDate || goal.targetDate || new Date(), "yyyy년 M월 d일 EEEE")}</p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button type="button" className="icon-btn" onClick={() => onToggle(goal.id)} aria-label="목표 완료">
            <CheckCircle2 size={16} />
          </button>
          <button
            type="button"
            className="icon-btn hover:border-danger hover:text-red-100"
            onClick={() => window.confirm("목표를 삭제할까요?") && onDelete(goal.id)}
            aria-label="목표 삭제"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>
      <details className="mt-3 rounded-lg border border-ink-700/70 bg-ink-950/35 px-3 py-2">
        <summary className="cursor-pointer text-xs font-semibold text-ink-400 hover:text-ink-100">
          진행률 수정
        </summary>
        <div className="mt-3">
          <ProgressBar value={displayProgress} label="진행률" />
        </div>
        <input
          type="range"
          min="0"
          max="100"
          value={displayProgress}
          onChange={(event) => onUpdate(goal.id, { progress: Number(event.target.value) })}
          disabled={goal.completed}
          className="mt-3 w-full accent-accent-500 disabled:opacity-50"
        />
      </details>
    </article>
  );
}
