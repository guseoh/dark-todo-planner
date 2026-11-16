import type { Todo } from "../types/todo";

export type SelectionState = "none" | "some" | "all";

export const UNCATEGORIZED_KEY = "uncategorized";

/** Whether none, some or all of a group's Todos are selected. */
export function groupSelectionState(ids: readonly string[], selected: ReadonlySet<string>): SelectionState {
  if (!ids.length) return "none";
  const count = ids.filter((id) => selected.has(id)).length;
  return count === 0 ? "none" : count === ids.length ? "all" : "some";
}

/** Selects a whole group, or clears it when it is already fully selected. Other groups are untouched. */
export function toggleGroupSelection(selected: ReadonlySet<string>, ids: readonly string[]): Set<string> {
  const next = new Set(selected);
  if (groupSelectionState(ids, selected) === "all") ids.forEach((id) => next.delete(id));
  else ids.forEach((id) => next.add(id));
  return next;
}

/** Selected becomes unselected and vice versa, within the given (currently shown) ids. */
export function invertSelection(shownIds: readonly string[], selected: ReadonlySet<string>): Set<string> {
  return new Set(shownIds.filter((id) => !selected.has(id)));
}

export type SelectionGroup = { key: string; categoryId?: string; ids: string[]; selected: number };

/** Groups the shown Todos by category (uncategorized last) for the "exclude a group" chips. */
export function selectionGroups(todos: readonly Todo[], selected: ReadonlySet<string>): SelectionGroup[] {
  const groups = new Map<string, SelectionGroup>();
  for (const todo of todos) {
    const key = todo.categoryId ?? UNCATEGORIZED_KEY;
    const group = groups.get(key) ?? { key, categoryId: todo.categoryId, ids: [], selected: 0 };
    group.ids.push(todo.id);
    if (selected.has(todo.id)) group.selected += 1;
    groups.set(key, group);
  }
  return [...groups.values()].sort((a, b) => (a.key === UNCATEGORIZED_KEY ? 1 : 0) - (b.key === UNCATEGORIZED_KEY ? 1 : 0));
}
