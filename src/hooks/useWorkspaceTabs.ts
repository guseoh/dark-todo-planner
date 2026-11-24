import { useCallback, useEffect, useState } from "react";
import { closeWorkspaceTab, emptyWorkspaceTabs, openWorkspaceTab, parseWorkspaceTabs, reopenWorkspaceTab, replaceWorkspaceTab } from "../lib/workspaceTabs";

export function useWorkspaceTabs(kind: "project" | "memo") {
  const key = `dark-todo-planner:workspace-tabs:${kind}:v1`;
  const [state, setState] = useState(() => {
    try { return parseWorkspaceTabs(localStorage.getItem(key)); } catch { return emptyWorkspaceTabs(); }
  });
  useEffect(() => {
    try { localStorage.setItem(key, JSON.stringify(state)); } catch { /* Optional display preference. */ }
  }, [key, state]);
  const open = useCallback((id: string) => setState((current) => openWorkspaceTab(current, id)), []);
  const close = useCallback((id: string) => setState((current) => closeWorkspaceTab(current, id)), []);
  const showList = useCallback(() => setState((current) => current.activeId === null ? current : { ...current, activeId: null }), []);
  const reopen = useCallback((available: readonly string[]) => setState((current) => reopenWorkspaceTab(current, available)), []);
  const replace = useCallback((from: string, to: string) => setState((current) => replaceWorkspaceTab(current, from, to)), []);
  return { ...state, open, close, showList, reopen, replace };
}
