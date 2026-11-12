import { addDays } from "date-fns";
import { parseDateKey, toDateKey } from "./date";
import type { TodoPlanningState, TodoPriority } from "../types/todo";

export type QuickTodoReference = {
  id: string;
  name: string;
};

export type QuickTodoContext = {
  categories?: QuickTodoReference[];
  projects?: QuickTodoReference[];
};

export type QuickTodoTokens = {
  title: string;
  date?: string;
  dueDate?: string;
  priority?: TodoPriority;
  planningState?: TodoPlanningState;
  categoryId?: string;
  projectId?: string;
};

const priorityTokens: Array<[RegExp, TodoPriority]> = [
  [/!(?:high|높음)(?=\s|$)/gi, "HIGH"],
  [/!(?:medium|보통)(?=\s|$)/gi, "MEDIUM"],
  [/!(?:low|낮음)(?=\s|$)/gi, "LOW"],
];

const planningTokens: Array<[RegExp, TodoPlanningState]> = [
  [/(?:^|\s)(?:someday|언젠가)(?=\s|$)/gi, "SOMEDAY"],
  [/(?:^|\s)(?:waiting|대기)(?=\s|$)/gi, "WAITING"],
];

const normalizeWhitespace = (value: string) => value.replace(/\s+/g, " ").trim();
const normalizeReferenceName = (value: string) => value.normalize("NFKC").trim().toLocaleLowerCase();

const parseRelativeDate = (value: string, plannerToday: string) => {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const today = parseDateKey(plannerToday);
  const offset = value === "내일" ? 1 : value === "모레" ? 2 : 0;
  return toDateKey(addDays(today, offset));
};

const resolveNamedReference = (
  source: string,
  marker: "@" | "+",
  items: QuickTodoReference[] = [],
): { source: string; id?: string; match?: RegExpMatchArray } => {
  if (!items.length) return { source };
  const pattern = marker === "@"
    ? /(?:^|\s)@\{([^}]+)\}(?=\s|$)|(?:^|\s)@([^\s@{}]+)(?=\s|$)/g
    : /(?:^|\s)\+\{([^}]+)\}(?=\s|$)|(?:^|\s)\+([^\s+{}]+)(?=\s|$)/g;

  for (const match of source.matchAll(pattern)) {
    const candidate = (match[1] || match[2] || "").trim();
    const item = items.find((entry) => normalizeReferenceName(entry.name) === normalizeReferenceName(candidate));
    if (!item || match.index === undefined) continue;
    return {
      source: `${source.slice(0, match.index)}${" ".repeat(match[0].length)}${source.slice(match.index + match[0].length)}`,
      id: item.id,
      match,
    };
  }
  return { source };
};

export type QuickTodoChip = { start: number; end: number; text: string; value: string };

export function parseQuickTodoDraft(raw: string, plannerToday: string, context: QuickTodoContext = {}) {
  let source = raw;
  const chips: QuickTodoChip[] = [];
  const record = (match: RegExpMatchArray | undefined, value: string) => {
    if (match?.index === undefined) return;
    const text = match[0].trim();
    const start = match.index + match[0].indexOf(text);
    chips.push({ start, end: start + text.length, text, value });
  };
  const mask = (match: string) => " ".repeat(match.length);

  const projectReference = resolveNamedReference(source, "@", context.projects);
  source = projectReference.source;
  record(projectReference.match, context.projects?.find(({ id }) => id === projectReference.id)?.name ?? "");
  const categoryReference = resolveNamedReference(source, "+", context.categories);
  source = categoryReference.source;
  record(categoryReference.match, context.categories?.find(({ id }) => id === categoryReference.id)?.name ?? "");

  let priority: TodoPriority | undefined;
  for (const [pattern, value] of priorityTokens) {
    for (const match of source.matchAll(pattern)) {
      priority = value;
      record(match, { HIGH: "높음", MEDIUM: "보통", LOW: "낮음" }[value]);
    }
    source = source.replace(pattern, mask);
  }

  let planningState: TodoPlanningState | undefined;
  for (const [pattern, value] of planningTokens) {
    for (const match of source.matchAll(pattern)) {
      planningState = value;
      record(match, value === "SOMEDAY" ? "언젠가" : "대기");
    }
    source = source.replace(pattern, mask);
  }

  let date: string | undefined;
  const explicitDateToken = source.match(/(?:date:|일정:)(\d{4}-\d{2}-\d{2}|오늘|내일|모레)(?=\s|$)/i);
  if (explicitDateToken) {
    date = parseRelativeDate(explicitDateToken[1], plannerToday);
    record(explicitDateToken, date);
    source = source.replace(explicitDateToken[0], mask);
    planningState = "SCHEDULED";
  } else {
    const dateToken = source.match(/(?:^|\s)(오늘|내일|모레)(?=\s|$)/);
    if (dateToken) {
      date = parseRelativeDate(dateToken[1], plannerToday);
      record(dateToken, date);
      source = source.replace(dateToken[0], mask);
      planningState = "SCHEDULED";
    }
  }

  let dueDate: string | undefined;
  const dueToken = source.match(/(?:due:|마감:)(\d{4}-\d{2}-\d{2}|오늘|내일|모레)(?=\s|$)/i);
  if (dueToken) {
    dueDate = parseRelativeDate(dueToken[1], plannerToday);
    record(dueToken, dueDate);
    source = source.replace(dueToken[0], mask);
  }

  const result: QuickTodoTokens = {
    title: normalizeWhitespace(source),
  };
  if (date) result.date = date;
  if (dueDate) result.dueDate = dueDate;
  if (priority) result.priority = priority;
  if (planningState) result.planningState = planningState;
  if (categoryReference.id) result.categoryId = categoryReference.id;
  if (projectReference.id) result.projectId = projectReference.id;
  return { todo: result, chips: chips.sort((a, b) => a.start - b.start) };
}

export function parseQuickTodoTitle(raw: string, plannerToday: string, context: QuickTodoContext = {}): QuickTodoTokens {
  return parseQuickTodoDraft(raw, plannerToday, context).todo;
}
