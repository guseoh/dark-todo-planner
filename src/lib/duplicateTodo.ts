import type { Todo, TodoInput } from "../types/todo";
import { todayKey } from "./date";

/** Reuse a saved task as a starting point, not its identity, old schedule or external linkage. */
export function duplicateTodoInput(todo: Todo, date = todayKey()): TodoInput {
  return { title: todo.title, memo: todo.memo, categoryId: todo.categoryId, projectId: todo.projectId,
    priority: todo.priority, date, planningState: "SCHEDULED", workflowStatus: "TODO" };
}
