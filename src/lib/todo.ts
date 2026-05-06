import type { Todo, TodoPriority } from "../types/todo";
import type { TodoRepeat } from "../types/todo";
import { getDayIndex, parseDateKey } from "./date";

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

export const repeatLabel: Record<TodoRepeat, string> = {
  NONE: "반복 없음",
  DAILY: "매일",
  WEEKLY: "매주",
  MONTHLY: "매월",
  WEEKDAY: "평일",
  WEEKEND: "주말",
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

export const todoOccursOnDate = (todo: Todo, dateKey: string) => {
  if (todo.archived) return false;
  if (todo.repeat === "NONE") return todo.date === dateKey;
  if (dateKey < todo.date) return false;

  const baseDate = parseDateKey(todo.date);
  const targetDate = parseDateKey(dateKey);
  const baseDay = getDayIndex(baseDate);
  const targetDay = getDayIndex(targetDate);

  if (todo.repeat === "DAILY") return true;
  if (todo.repeat === "WEEKLY") return baseDay === targetDay;
  if (todo.repeat === "MONTHLY") return baseDate.getDate() === targetDate.getDate();
  if (todo.repeat === "WEEKDAY") return targetDay >= 1 && targetDay <= 5;
  if (todo.repeat === "WEEKEND") return targetDay === 0 || targetDay === 6;
  return false;
};

export const getAllTags = (todos: Todo[]) =>
  Array.from(new Set(todos.flatMap((todo) => todo.tags || []))).sort((a, b) => a.localeCompare(b));
