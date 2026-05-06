import type { Todo, TodoPriority } from "../types/todo";

export const TODO_STORAGE_KEY = "dark-todo-planner.todos";

const priorities: TodoPriority[] = ["LOW", "MEDIUM", "HIGH"];

const isString = (value: unknown): value is string => typeof value === "string";

const isTodo = (value: unknown): value is Todo => {
  if (!value || typeof value !== "object") return false;
  const todo = value as Todo;

  return (
    isString(todo.id) &&
    isString(todo.title) &&
    isString(todo.date) &&
    priorities.includes(todo.priority) &&
    typeof todo.completed === "boolean" &&
    isString(todo.createdAt) &&
    isString(todo.updatedAt) &&
    (todo.memo === undefined || isString(todo.memo)) &&
    (todo.startTime === undefined || isString(todo.startTime)) &&
    (todo.endTime === undefined || isString(todo.endTime))
  );
};

export const loadTodos = (): Todo[] => {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(TODO_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isTodo) : [];
  } catch {
    return [];
  }
};

export const saveTodos = (todos: Todo[]) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(TODO_STORAGE_KEY, JSON.stringify(todos));
};

export const validateTodos = (value: unknown): Todo[] | null => {
  if (!Array.isArray(value)) return null;
  if (!value.every(isTodo)) return null;
  return value;
};
