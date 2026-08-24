import type { Todo } from "../types/todo";
import { getTodoDuplicateKey } from "./todoRecovery";

export type PreparedOverdueBulkImport = {
  ids: string[];
  total: number;
  skipped: number;
};

export function prepareOverdueBulkImport(
  overdueTodos: Todo[],
  selectedIds: ReadonlySet<string>,
  todayTodos: Todo[],
): PreparedOverdueBulkImport {
  const selectedTodos = overdueTodos
    .filter((todo) => selectedIds.has(todo.id))
    .sort(
      (a, b) =>
        b.date.localeCompare(a.date) ||
        b.createdAt.localeCompare(a.createdAt) ||
        a.id.localeCompare(b.id),
    );

  const todayKeys = new Set(
    todayTodos
      .filter((todo) => !todo.archived)
      .map(getTodoDuplicateKey),
  );
  const ids: string[] = [];
  let skipped = 0;

  for (const todo of selectedTodos) {
    const duplicateKey = getTodoDuplicateKey(todo);
    if (todayKeys.has(duplicateKey)) {
      skipped += 1;
      continue;
    }
    ids.push(todo.id);
    todayKeys.add(duplicateKey);
  }

  return { ids, total: selectedTodos.length, skipped };
}
