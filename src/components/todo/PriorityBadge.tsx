import { priorityClassName, priorityLabel } from "../../lib/todo";
import type { TodoPriority } from "../../types/todo";

type PriorityBadgeProps = {
  priority: TodoPriority;
  compact?: boolean;
};

export function PriorityBadge({ priority, compact = false }: PriorityBadgeProps) {
  return (
    <span
      className={`inline-flex rounded-full border font-semibold ${compact ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs"} ${priorityClassName[priority]}`}
    >
      {priorityLabel[priority]}
    </span>
  );
}
