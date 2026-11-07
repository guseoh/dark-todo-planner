import type { Todo } from "../types/todo";

/** Today candidates are existing tasks, not copies or changes to deadlines. */
export function isTodayPlanningCandidate(todo: Todo, plannerToday: string): boolean {
  if (todo.archived || todo.completed || todo.workflowStatus === "DONE" || todo.workflowStatus === "BLOCKED") return false;
  if (todo.planningState === "WAITING") return false;
  if (todo.planningState === "SCHEDULED") return todo.date > plannerToday;
  return todo.planningState === "SOMEDAY" || todo.planningState === "INBOX";
}

export function selectTodayCandidates(todos: readonly Todo[], plannerToday: string, maxItems = 6): Todo[] {
  if (maxItems <= 0) return [];
  const planned = todos
    .filter((todo) => isTodayPlanningCandidate(todo, plannerToday) && todo.planningState === "SCHEDULED")
    .sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title, "ko"));
  const unplanned = todos
    .filter((todo) => isTodayPlanningCandidate(todo, plannerToday) && todo.planningState !== "SCHEDULED")
    .sort((a, b) => (b.priority === "HIGH" ? 1 : 0) - (a.priority === "HIGH" ? 1 : 0)
      || a.title.localeCompare(b.title, "ko"));
  // Reserve room for both scheduled and unplanned work when the list is dense.
  const plannedQuota = unplanned.length ? Math.min(planned.length, Math.max(1, Math.ceil(maxItems / 2))) : maxItems;
  const first = planned.slice(0, plannedQuota);
  const second = unplanned.slice(0, maxItems - first.length);
  return [...first, ...second, ...planned.slice(first.length, first.length + maxItems - first.length - second.length)];
}
