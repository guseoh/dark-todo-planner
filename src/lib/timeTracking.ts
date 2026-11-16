import { PLANNER_DAY_START_HOUR, parseDateKey } from "./date";
import type { Category } from "../types/category";
import type { ActiveTimer, TimeEntry, TimerTarget } from "../types/timeTracking";
import { getEntityColor } from "./entityColor";

const MINUTE_MS = 60_000;
export const DAY_MINUTES = 24 * 60;

/** Local wall-clock start of a planner day: 03:00 of that calendar date. */
export const plannerDayStart = (dateKey: string): Date => {
  const day = parseDateKey(dateKey);
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), PLANNER_DAY_START_HOUR, 0, 0, 0);
};

/** "1:05:09" — hours are not padded so short sessions read as "0:07:30". */
export function formatClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

/** "2시간 5분", "45분", "2시간". */
export function formatDuration(ms: number): string {
  const minutes = Math.max(0, Math.round(ms / MINUTE_MS));
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (!hours) return `${rest}분`;
  return rest ? `${hours}시간 ${rest}분` : `${hours}시간`;
}

/** True when the running timer was started on exactly this target. */
export function isTargetRunning(active: ActiveTimer | null | undefined, target: TimerTarget): boolean {
  if (!active) return false;
  if ("todoId" in target) return active.todoId === target.todoId;
  if (active.todoId) return false;
  if ("projectId" in target) return active.projectId === target.projectId;
  return !active.projectId && active.categoryId === target.categoryId;
}

/** "1h 30m", "45m", "2h" — for tight spots such as calendar day cells. */
export function formatShortDuration(ms: number): string {
  const minutes = Math.max(0, Math.round(ms / MINUTE_MS));
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (!hours) return `${rest}m`;
  return rest ? `${hours}h ${rest}m` : `${hours}h`;
}

export type DayInterval = { start: number; end: number };

/** The part of [startedAt, endedAt] that falls on a planner day, in minutes from 03:00 (0–1440). */
export function intervalOnDay(startedAt: string, endedAt: string, dateKey: string): DayInterval | null {
  const dayStart = plannerDayStart(dateKey).getTime();
  const dayEnd = dayStart + DAY_MINUTES * MINUTE_MS;
  const start = Math.max(Date.parse(startedAt), dayStart);
  const end = Math.min(Date.parse(endedAt), dayEnd);
  if (!(end > start)) return null;
  return { start: (start - dayStart) / MINUTE_MS, end: (end - dayStart) / MINUTE_MS };
}

/** Hour label for a minute offset from the planner-day start, e.g. 0 → "03:00", 21*60 → "00:00". */
export const clockLabel = (offsetMinutes: number): string => {
  const total = (PLANNER_DAY_START_HOUR * 60 + Math.round(offsetMinutes)) % DAY_MINUTES;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
};

/** A running timer rendered like an entry so totals and timelines include it live. */
export function activeAsEntry(active: ActiveTimer, nowMs: number): TimeEntry {
  return {
    id: "active", todoId: active.todoId, title: active.todoTitle, categoryId: active.categoryId, categoryName: active.categoryName,
    projectId: active.projectId, plannerDate: "", startedAt: active.startedAt,
    endedAt: new Date(Math.max(nowMs, Date.parse(active.startedAt))).toISOString(), durationMinutes: 0,
  };
}

export const entryColor = (entry: Pick<TimeEntry, "categoryId">, categories: Category[]): string => {
  const category = entry.categoryId ? categories.find(({ id }) => id === entry.categoryId) : undefined;
  return category ? getEntityColor(category, categories) : "var(--text-muted)";
};
export const entryCategoryName = (entry: Pick<TimeEntry, "categoryId" | "categoryName">, categories: Category[]): string =>
  (entry.categoryId ? categories.find(({ id }) => id === entry.categoryId)?.name : undefined) ?? entry.categoryName ?? "미분류";

export type CategoryTotal = { key: string; categoryId?: string; name: string; color: string; ms: number };
const UNCATEGORIZED = "uncategorized";

/** Measured time per category on one planner day (or summed over several days), largest first. */
export function totalsByCategory(entries: TimeEntry[], dateKeys: string[], categories: Category[]): CategoryTotal[] {
  const totals = new Map<string, CategoryTotal>();
  for (const entry of entries) {
    let ms = 0;
    for (const dateKey of dateKeys) {
      const part = intervalOnDay(entry.startedAt, entry.endedAt, dateKey);
      if (part) ms += (part.end - part.start) * MINUTE_MS;
    }
    if (!ms) continue;
    const category = entry.categoryId ? categories.find(({ id }) => id === entry.categoryId) : undefined;
    const key = entry.categoryId ?? UNCATEGORIZED;
    const current = totals.get(key);
    if (current) current.ms += ms;
    else totals.set(key, {
      key, categoryId: entry.categoryId, ms,
      name: category?.name ?? entry.categoryName ?? "미분류",
      color: category ? getEntityColor(category, categories) : "var(--text-muted)",
    });
  }
  return [...totals.values()].sort((a, b) => b.ms - a.ms);
}

export const totalMs = (totals: CategoryTotal[]) => totals.reduce((sum, item) => sum + item.ms, 0);

export type HourCell = { hour: number; label: string; segments: Array<{ key: string; color: string; name: string; ms: number }> };

/** 24 hourly buckets (from 03:00) with measured time per category, for the whole-day timeline. */
export function hourlyBuckets(entries: TimeEntry[], dateKey: string, categories: Category[]): HourCell[] {
  const cells: HourCell[] = Array.from({ length: 24 }, (_, hour) => ({ hour, label: clockLabel(hour * 60), segments: [] }));
  for (const entry of entries) {
    const part = intervalOnDay(entry.startedAt, entry.endedAt, dateKey);
    if (!part) continue;
    const category = entry.categoryId ? categories.find(({ id }) => id === entry.categoryId) : undefined;
    const key = entry.categoryId ?? UNCATEGORIZED;
    for (let hour = Math.floor(part.start / 60); hour <= Math.min(23, Math.floor((part.end - 0.0001) / 60)); hour += 1) {
      const overlap = Math.min(part.end, (hour + 1) * 60) - Math.max(part.start, hour * 60);
      if (overlap <= 0) continue;
      const cell = cells[hour];
      const existing = cell.segments.find((segment) => segment.key === key);
      if (existing) existing.ms += overlap * MINUTE_MS;
      else cell.segments.push({
        key, ms: overlap * MINUTE_MS, name: category?.name ?? entry.categoryName ?? "미분류",
        color: category ? getEntityColor(category, categories) : "var(--text-muted)",
      });
    }
  }
  return cells;
}

/** `datetime-local` value ("2026-11-16T09:30") for an ISO instant, in the browser's local time. */
export const toLocalInput = (iso: string): string => {
  const date = new Date(iso);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};
export const fromLocalInput = (value: string): string => new Date(value).toISOString();
