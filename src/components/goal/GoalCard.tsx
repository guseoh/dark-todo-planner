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
  return (
    <article className={`app-card p-5 ${goal.completed ? "opacity-60" : ""}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className={`break-words text-lg font-bold text-ink-100 ${goal.completed ? "line-through" : ""}`}>{goal.title}</h3>
            <span className="rounded-full border border-warning/45 bg-warning/15 px-2.5 py-1 text-xs font-bold text-amber-100">
              {getDdayLabel(goal.dueDate)}
            </span>
          </div>
          {goal.description ? <p className="mt-2 text-sm text-ink-400">{goal.description}</p> : null}
          <p className="mt-2 text-xs text-ink-500">마감 {formatKoreanDate(goal.dueDate, "yyyy년 M월 d일 EEEE")}</p>
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
      <div className="mt-4">
        <ProgressBar value={goal.progress} label="진행률" />
        <input
          type="range"
          min="0"
          max="100"
          value={goal.progress}
          onChange={(event) => onUpdate(goal.id, { progress: Number(event.target.value) })}
          className="mt-3 w-full accent-accent-500"
        />
      </div>
    </article>
  );
}
