import { priorityClassName, priorityLabel } from "../../lib/todo";
import type { TodoPriority } from "../../types/todo";

type PriorityBadgeProps = {
  priority: TodoPriority;
};

export function PriorityBadge({ priority }: PriorityBadgeProps) {
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${priorityClassName[priority]}`}>
      {priorityLabel[priority]}
    </span>
  );
}
