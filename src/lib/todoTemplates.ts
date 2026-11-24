import type { TodoInput, TodoPriority } from "../types/todo";
export type TodoTemplate = { id: string; title: string; memo: string; priority: TodoPriority; projectId?: string; categoryId?: string };
export const TODO_TEMPLATE_KEY = "tern:v4:todo-templates";
export function readTodoTemplates(storage: Pick<Storage, "getItem">): TodoTemplate[] {
  try {
    const value: unknown = JSON.parse(storage.getItem(TODO_TEMPLATE_KEY) ?? "[]");
    if (!Array.isArray(value)) return [];
    return value.filter((item): item is TodoTemplate => Boolean(item && typeof item.id === "string" && typeof item.title === "string" && item.title.trim() && typeof item.memo === "string" && ["LOW", "MEDIUM", "HIGH"].includes(item.priority) && (item.projectId === undefined || typeof item.projectId === "string") && (item.categoryId === undefined || typeof item.categoryId === "string"))).slice(0, 30);
  } catch { return []; }
}
export function makeTodoTemplate(id: string, input: TodoInput): TodoTemplate {
  return { id, title: input.title.trim().slice(0, 200), memo: (input.memo ?? "").slice(0, 2000), priority: input.priority ?? "MEDIUM", projectId: input.projectId, categoryId: input.categoryId };
}
