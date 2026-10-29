import { appViewIds, type AppView } from "../components/layout/Sidebar";

const VIEW_PREFIX = "#/";
export type CalendarMode = "month" | "week";

export const viewHash = (view: AppView, mode: CalendarMode = "month"): string =>
  view === "calendar" ? `${VIEW_PREFIX}calendar/${mode}` : `${VIEW_PREFIX}${view}`;

// Previously shared links remain valid, while the sidebar has one calendar entry.
export function viewFromHash(hash: string): AppView {
  if (["#/calendar", "#/calendar/month", "#/calendar/week", "#/month", "#/week"].includes(hash)) return "calendar";
  const candidate = hash.startsWith(VIEW_PREFIX) ? hash.slice(VIEW_PREFIX.length) : "";
  return appViewIds.find((view) => view === candidate) ?? "today";
}
export function calendarModeFromHash(hash: string): CalendarMode {
  return hash === "#/week" || hash === "#/calendar/week" ? "week" : "month";
}
