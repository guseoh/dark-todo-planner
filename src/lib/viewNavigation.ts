import { appViewIds, type AppView } from "../components/layout/Sidebar";

const VIEW_PREFIX = "#/";
export const viewHash = (view: AppView): string => `${VIEW_PREFIX}${view}`;
export function viewFromHash(hash: string): AppView {
  const candidate = hash.startsWith(VIEW_PREFIX) ? hash.slice(VIEW_PREFIX.length) : "";
  return appViewIds.find((view) => view === candidate) ?? "today";
}
