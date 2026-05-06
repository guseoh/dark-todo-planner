import type { Todo, TodoPriority } from "../types/todo";

export const priorityRank: Record<TodoPriority, number> = {
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1,
};

export const priorityLabel: Record<TodoPriority, string> = {
  HIGH: "높음",
  MEDIUM: "보통",
  LOW: "낮음",
};

export const priorityClassName: Record<TodoPriority, string> = {
  HIGH: "border-danger/45 bg-danger/15 text-red-100",
  MEDIUM: "border-warning/45 bg-warning/15 text-amber-100",
  LOW: "border-success/45 bg-success/15 text-emerald-100",
};

export const calculateRate = (todos: Todo[]) => {
  if (todos.length === 0) return 0;
  return Math.round((todos.filter((todo) => todo.completed).length / todos.length) * 100);
};

export const sortByTime = (todos: Todo[]) =>
  [...todos].sort((a, b) => {
    const aTime = a.startTime || "24:00";
    const bTime = b.startTime || "24:00";
    if (aTime !== bTime) return aTime.localeCompare(bTime);
    return priorityRank[b.priority] - priorityRank[a.priority];
  });
