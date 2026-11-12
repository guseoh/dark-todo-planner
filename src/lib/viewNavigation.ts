import { appViewIds, type AppView } from "../components/layout/Sidebar";
import { parseDateKey } from "./date";

const VIEW_PREFIX = "#/";
export type CalendarMode = "month" | "week";

export const viewHash = (view: AppView, mode: CalendarMode = "month"): string =>
  view === "calendar" ? `${VIEW_PREFIX}calendar/${mode}` : `${VIEW_PREFIX}${view}`;

// Previously shared links remain valid, while the sidebar has one calendar entry.
export function viewFromHash(hash: string): AppView {
  hash = hash.split("?")[0];
  if (hash === "#/inbox") return "all"; // Legacy bookmark.
  if (["#/calendar", "#/calendar/month", "#/calendar/week", "#/month", "#/week"].includes(hash)) return "calendar";
  const candidate = hash.startsWith(VIEW_PREFIX) ? hash.slice(VIEW_PREFIX.length) : "";
  return appViewIds.find((view) => view === candidate) ?? "today";
}
export function calendarModeFromHash(hash: string): CalendarMode {
  hash = hash.split("?")[0];
  return hash === "#/week" || hash === "#/calendar/week" ? "week" : "month";
}

export function calendarDateFromHash(hash: string): string | undefined {
  const date = new URLSearchParams(hash.split("?")[1]).get("date");
  return date && /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(parseDateKey(date).getTime()) ? date : undefined;
}
