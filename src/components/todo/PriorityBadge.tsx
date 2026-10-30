import { priorityLabel } from "../../lib/todo";
import type { TodoPriority } from "../../types/todo";

type PriorityBadgeProps = {
  priority: TodoPriority;
  compact?: boolean;
};

export function PriorityBadge({ priority, compact = false }: PriorityBadgeProps) {
  return (
    <span
      className={`inline-flex items-center font-medium leading-5 ${compact ? "text-[11px]" : "text-xs"} ${priority === "HIGH" ? "text-red-200" : priority === "LOW" ? "text-ink-500" : "text-ink-400"}`}
      aria-label={`우선순위 ${priorityLabel[priority]}`}
    >
      {priorityLabel[priority]}
    </span>
  );
}
