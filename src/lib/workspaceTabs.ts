export type WorkspaceTabState = { opened: string[]; activeId: string | null; closed: string[] };
export const emptyWorkspaceTabs = (): WorkspaceTabState => ({ opened: [], activeId: null, closed: [] });
const ids = (value: unknown): string[] => Array.isArray(value)
  ? Array.from(new Set(value.filter((id): id is string => typeof id === "string" && Boolean(id)))) : [];

export function parseWorkspaceTabs(raw: string | null): WorkspaceTabState {
  if (!raw) return emptyWorkspaceTabs();
  try {
    const value = JSON.parse(raw);
    if (!value || typeof value !== "object") return emptyWorkspaceTabs();
    const opened = ids(value.opened);
    return { opened, activeId: typeof value.activeId === "string" && opened.includes(value.activeId) ? value.activeId : null,
      closed: ids(value.closed).filter((id) => !opened.includes(id)).slice(-30) };
  } catch { return emptyWorkspaceTabs(); }
}
export function openWorkspaceTab(state: WorkspaceTabState, id: string): WorkspaceTabState {
  if (!id || (state.activeId === id && state.opened.includes(id))) return state;
  return { opened: state.opened.includes(id) ? state.opened : [...state.opened, id], activeId: id,
    closed: state.closed.filter((closed) => closed !== id) };
}
export function closeWorkspaceTab(state: WorkspaceTabState, id: string): WorkspaceTabState {
  const index = state.opened.indexOf(id);
  if (index < 0) return state;
  const opened = state.opened.filter((item) => item !== id);
  return { opened, activeId: state.activeId === id ? opened[index] ?? opened[index - 1] ?? null : state.activeId,
    closed: [...state.closed.filter((item) => item !== id), id].slice(-30) };
}
export function reopenWorkspaceTab(state: WorkspaceTabState, available: readonly string[]): WorkspaceTabState {
  const id = [...state.closed].reverse().find((item) => available.includes(item));
  return id ? openWorkspaceTab(state, id) : state;
}
export function replaceWorkspaceTab(state: WorkspaceTabState, from: string, to: string): WorkspaceTabState {
  if (from === to || !state.opened.includes(from)) return state;
  return { opened: Array.from(new Set(state.opened.map((id) => id === from ? to : id))),
    activeId: state.activeId === from ? to : state.activeId,
    closed: state.closed.filter((id) => id !== from && id !== to) };
}
