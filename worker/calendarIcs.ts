const encoder = new TextEncoder();

export type CalendarTodo = {
  id: string;
  title: string;
  memo?: string | null;
  referenceUrl?: string | null;
  referenceLabel?: string | null;
  date: string;
  updatedAt: string;
  projectName?: string | null;
  categoryName?: string | null;
};

export type CalendarTimeBlock = {
  id: string;
  todoId?: string | null;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  updatedAt: string;
  todoTitle?: string | null;
  referenceUrl?: string | null;
};

type CalendarInput = {
  todos: CalendarTodo[];
  timeBlocks: CalendarTimeBlock[];
  generatedAt?: Date;
};

const escapeText = (value: string) => value
  .replace(/\\/g, "\\\\")
  .replace(/\r\n|\r|\n/g, "\\n")
  .replace(/;/g, "\\;")
  .replace(/,/g, "\\,");

const cleanUri = (value?: string | null) => {
  if (!value) return "";
  const trimmed = value.trim().replace(/[\r\n]/g, "");
  try {
    const url = new URL(trimmed);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : "";
  } catch {
    return "";
  }
};

const toDateValue = (date: string) => date.replace(/-/g, "");

const nextDateValue = (date: string) => {
  const [year, month, day] = date.split("-").map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + 1));
  return `${next.getUTCFullYear()}${String(next.getUTCMonth() + 1).padStart(2, "0")}${String(next.getUTCDate()).padStart(2, "0")}`;
};

const localDateTimeValue = (date: string, time: string) => `${toDateValue(date)}T${time.replace(":", "")}00`;

const utcDateTimeValue = (value: Date | string) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "19700101T000000Z";
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
};

const foldLine = (line: string) => {
  const parts: string[] = [];
  let current = "";
  let limit = 75;
  for (const char of line) {
    if (encoder.encode(current + char).length <= limit) {
      current += char;
      continue;
    }
    parts.push(current);
    current = char;
    limit = 74;
  }
  parts.push(current);
  return parts.map((part, index) => index === 0 ? part : ` ${part}`).join("\r\n");
};

const descriptionLines = (values: Array<string | null | undefined>) => values
  .map((value) => value?.trim())
  .filter((value): value is string => Boolean(value));

const eventLines = (lines: string[]) => ["BEGIN:VEVENT", ...lines, "STATUS:CONFIRMED", "END:VEVENT"];

export function buildCalendarIcs({ todos, timeBlocks, generatedAt = new Date() }: CalendarInput) {
  const linkedTodoIds = new Set(timeBlocks.map((block) => block.todoId).filter((id): id is string => Boolean(id)));
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Dark Todo Planner//Calendar Export//KO",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:Dark Todo Planner",
    "X-WR-TIMEZONE:Asia/Seoul",
    "BEGIN:VTIMEZONE",
    "TZID:Asia/Seoul",
    "X-LIC-LOCATION:Asia/Seoul",
    "BEGIN:STANDARD",
    "TZOFFSETFROM:+0900",
    "TZOFFSETTO:+0900",
    "TZNAME:KST",
    "DTSTART:19700101T000000",
    "END:STANDARD",
    "END:VTIMEZONE",
  ];
  const dtstamp = utcDateTimeValue(generatedAt);

  for (const block of timeBlocks) {
    const description = descriptionLines([
      block.todoTitle && block.todoTitle !== block.title ? `Todo: ${block.todoTitle}` : null,
      block.todoId ? "Dark Todo Planner 시간 블록" : "Dark Todo Planner 일정",
    ]).join("\n");
    const url = cleanUri(block.referenceUrl);
    lines.push(...eventLines([
      `UID:time-block-${block.id}@dark-todo-planner`,
      `DTSTAMP:${dtstamp}`,
      `LAST-MODIFIED:${utcDateTimeValue(block.updatedAt)}`,
      `DTSTART;TZID=Asia/Seoul:${localDateTimeValue(block.date, block.startTime)}`,
      `DTEND;TZID=Asia/Seoul:${localDateTimeValue(block.date, block.endTime)}`,
      `SUMMARY:${escapeText(block.title)}`,
      ...(description ? [`DESCRIPTION:${escapeText(description)}`] : []),
      ...(url ? [`URL:${url}`] : []),
      "TRANSP:OPAQUE",
    ]));
  }

  for (const todo of todos) {
    if (linkedTodoIds.has(todo.id)) continue;
    const description = descriptionLines([
      todo.memo,
      todo.projectName ? `프로젝트: ${todo.projectName}` : null,
      todo.categoryName ? `카테고리: ${todo.categoryName}` : null,
      todo.referenceLabel ? `관련 링크: ${todo.referenceLabel}` : null,
    ]).join("\n");
    const url = cleanUri(todo.referenceUrl);
    lines.push(...eventLines([
      `UID:todo-${todo.id}@dark-todo-planner`,
      `DTSTAMP:${dtstamp}`,
      `LAST-MODIFIED:${utcDateTimeValue(todo.updatedAt)}`,
      `DTSTART;VALUE=DATE:${toDateValue(todo.date)}`,
      `DTEND;VALUE=DATE:${nextDateValue(todo.date)}`,
      `SUMMARY:${escapeText(todo.title)}`,
      ...(description ? [`DESCRIPTION:${escapeText(description)}`] : []),
      ...(url ? [`URL:${url}`] : []),
      "TRANSP:OPAQUE",
    ]));
  }

  lines.push("END:VCALENDAR");
  return `${lines.map(foldLine).join("\r\n")}\r\n`;
}
