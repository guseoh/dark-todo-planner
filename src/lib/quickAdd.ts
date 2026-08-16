import { addDays } from "date-fns";
import { parseDateKey, toDateKey } from "./date";
import type { TodoPlanningState, TodoPriority, TodoRepeat } from "../types/todo";

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
  tags: string[];
  date?: string;
  dueDate?: string;
  estimateMinutes?: number;
  priority?: TodoPriority;
  planningState?: TodoPlanningState;
  repeat?: TodoRepeat;
  categoryId?: string;
  projectId?: string;
};

const priorityTokens: Array<[RegExp, TodoPriority]> = [
  [/!(?:high|높음)(?=\s|$)/gi, "HIGH"],
  [/!(?:medium|보통)(?=\s|$)/gi, "MEDIUM"],
  [/!(?:low|낮음)(?=\s|$)/gi, "LOW"],
];

const planningTokens: Array<[RegExp, TodoPlanningState]> = [
  [/(?:^|\s)(?:inbox|수신함)(?=\s|$)/gi, "INBOX"],
  [/(?:^|\s)(?:someday|언젠가)(?=\s|$)/gi, "SOMEDAY"],
  [/(?:^|\s)(?:waiting|대기)(?=\s|$)/gi, "WAITING"],
];

const repeatValues: Record<string, TodoRepeat> = {
  daily: "DAILY",
  weekly: "WEEKLY",
  monthly: "MONTHLY",
  weekday: "WEEKDAY",
  weekend: "WEEKEND",
  "매일": "DAILY",
  "매주": "WEEKLY",
  "매월": "MONTHLY",
  "평일": "WEEKDAY",
  "주말": "WEEKEND",
};

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
): { source: string; id?: string } => {
  if (!items.length) return { source };
  const pattern = marker === "@"
    ? /(?:^|\s)@\{([^}]+)\}(?=\s|$)|(?:^|\s)@([^\s@{}]+)(?=\s|$)/g
    : /(?:^|\s)\+\{([^}]+)\}(?=\s|$)|(?:^|\s)\+([^\s+{}]+)(?=\s|$)/g;

  for (const match of source.matchAll(pattern)) {
    const candidate = (match[1] || match[2] || "").trim();
    const item = items.find((entry) => normalizeReferenceName(entry.name) === normalizeReferenceName(candidate));
    if (!item || match.index === undefined) continue;
    return {
      source: `${source.slice(0, match.index)} ${source.slice(match.index + match[0].length)}`,
      id: item.id,
    };
  }
  return { source };
};

export function parseQuickTodoTitle(raw: string, plannerToday: string, context: QuickTodoContext = {}): QuickTodoTokens {
  let source = raw.trim();
  const tags = Array.from(source.matchAll(/#([^\s#]+)/g), (match) => match[1]).filter(Boolean);
  source = source.replace(/#([^\s#]+)/g, " ");

  const projectReference = resolveNamedReference(source, "@", context.projects);
  source = projectReference.source;
  const categoryReference = resolveNamedReference(source, "+", context.categories);
  source = categoryReference.source;

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

  let repeat: TodoRepeat | undefined;
  const repeatToken = source.match(/(?:repeat:|반복:)(daily|weekly|monthly|weekday|weekend|매일|매주|매월|평일|주말)(?=\s|$)/i);
  if (repeatToken) {
    repeat = repeatValues[repeatToken[1].toLocaleLowerCase()] || repeatValues[repeatToken[1]];
    source = source.replace(repeatToken[0], " ");
  }

  let date: string | undefined;
  const explicitDateToken = source.match(/(?:date:|일정:)(\d{4}-\d{2}-\d{2}|오늘|내일|모레)(?=\s|$)/i);
  if (explicitDateToken) {
    date = parseRelativeDate(explicitDateToken[1], plannerToday);
    source = source.replace(explicitDateToken[0], " ");
    planningState = "SCHEDULED";
  } else {
    const dateToken = source.match(/(?:^|\s)(오늘|내일|모레)(?=\s|$)/);
    if (dateToken) {
      date = parseRelativeDate(dateToken[1], plannerToday);
      source = source.replace(dateToken[0], " ");
      planningState = "SCHEDULED";
    }
  }

  let dueDate: string | undefined;
  const dueToken = source.match(/(?:due:|마감:)(\d{4}-\d{2}-\d{2}|오늘|내일|모레)(?=\s|$)/i);
  if (dueToken) {
    dueDate = parseRelativeDate(dueToken[1], plannerToday);
    source = source.replace(dueToken[0], " ");
  }

  let estimateMinutes: number | undefined;
  const durationToken = source.match(/(\d+(?:\.\d+)?)(m|h|분|시간)(?=\s|$)/i);
  if (durationToken) {
    const amount = Number(durationToken[1]);
    const unit = durationToken[2].toLowerCase();
    const minutes = unit === "h" || unit === "시간" ? Math.round(amount * 60) : Math.round(amount);
    if (minutes > 0 && minutes <= 1440) estimateMinutes = minutes;
    source = source.replace(durationToken[0], " ");
  }

  const result: QuickTodoTokens = {
    title: normalizeWhitespace(source),
    tags: Array.from(new Set(tags)),
  };
  if (date) result.date = date;
  if (dueDate) result.dueDate = dueDate;
  if (estimateMinutes) result.estimateMinutes = estimateMinutes;
  if (priority) result.priority = priority;
  if (planningState) result.planningState = planningState;
  if (repeat) result.repeat = repeat;
  if (categoryReference.id) result.categoryId = categoryReference.id;
  if (projectReference.id) result.projectId = projectReference.id;
  return result;
}
