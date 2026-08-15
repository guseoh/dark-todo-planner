import { addDays } from "date-fns";
import { parseDateKey, toDateKey } from "./date";
import type { TodoPlanningState, TodoPriority } from "../types/todo";

export type QuickTodoTokens = {
  title: string;
  tags: string[];
  date?: string;
  dueDate?: string;
  estimateMinutes?: number;
  priority?: TodoPriority;
  planningState?: TodoPlanningState;
};

const priorityTokens: Array<[RegExp, TodoPriority]> = [
  [/!high\b|!높음\b/gi, "HIGH"],
  [/!medium\b|!보통\b/gi, "MEDIUM"],
  [/!low\b|!낮음\b/gi, "LOW"],
];

const planningTokens: Array<[RegExp, TodoPlanningState]> = [
  [/\b(?:inbox|수신함)\b/gi, "INBOX"],
  [/\b(?:someday|언젠가)\b/gi, "SOMEDAY"],
  [/\b(?:waiting|대기)\b/gi, "WAITING"],
];

const normalizeWhitespace = (value: string) => value.replace(/\s+/g, " ").trim();

export function parseQuickTodoTitle(raw: string, plannerToday: string): QuickTodoTokens {
  let source = raw.trim();
  const tags = Array.from(source.matchAll(/#([^\s#]+)/g), (match) => match[1]).filter(Boolean);
  source = source.replace(/#([^\s#]+)/g, " ");

  let priority: TodoPriority | undefined;
  for (const [pattern, value] of priorityTokens) {
    if (pattern.test(source)) priority = value;
    pattern.lastIndex = 0;
    source = source.replace(pattern, " ");
  }

  let planningState: TodoPlanningState | undefined;
  for (const [pattern, value] of planningTokens) {
    if (pattern.test(source)) planningState = value;
    pattern.lastIndex = 0;
    source = source.replace(pattern, " ");
  }

  let date: string | undefined;
  const today = parseDateKey(plannerToday);
  const dateToken = source.match(/\b(오늘|내일|모레)\b/);
  if (dateToken) {
    const offset = dateToken[1] === "내일" ? 1 : dateToken[1] === "모레" ? 2 : 0;
    date = toDateKey(addDays(today, offset));
    source = source.replace(dateToken[0], " ");
    planningState = "SCHEDULED";
  }

  let dueDate: string | undefined;
  const dueToken = source.match(/(?:due:|마감:)(\d{4}-\d{2}-\d{2})/i);
  if (dueToken) {
    dueDate = dueToken[1];
    source = source.replace(dueToken[0], " ");
  }

  let estimateMinutes: number | undefined;
  const durationToken = source.match(/\b(\d+(?:\.\d+)?)(m|h|분|시간)\b/i);
  if (durationToken) {
    const amount = Number(durationToken[1]);
    const unit = durationToken[2].toLowerCase();
    const minutes = unit === "h" || unit === "시간" ? Math.round(amount * 60) : Math.round(amount);
    if (minutes > 0 && minutes <= 1440) estimateMinutes = minutes;
    source = source.replace(durationToken[0], " ");
  }

  return {
    title: normalizeWhitespace(source),
    tags: Array.from(new Set(tags)),
    date,
    dueDate,
    estimateMinutes,
    priority,
    planningState,
  };
}
