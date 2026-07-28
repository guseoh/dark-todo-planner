import type { Todo } from "../types/todo";

export type OverdueTodoImportMode = "copy" | "move";

export type OverdueTodoImportResult = {
  total: number;
  success: number;
  skipped: number;
  failed: number;
  mode: OverdueTodoImportMode;
};

export type DuplicateTodoGroup = {
  key: string;
  todos: Todo[];
};

const normalizeTitle = (title: string) => title.trim().toLocaleLowerCase("ko");

export const getTodoDuplicateKey = (todo: Pick<Todo, "title" | "categoryId" | "repeat">) =>
  `${normalizeTitle(todo.title)}::${todo.categoryId || ""}::${todo.repeat}`;

export function dedupeTodosById(todos: Todo[]): Todo[] {
  const seen = new Set<string>();
  return todos.filter((todo) => {
    if (seen.has(todo.id)) return false;
    seen.add(todo.id);
    return true;
  });
}

export function getOverdueIncompleteTodos(todos: Todo[], plannerToday: string): Todo[] {
  return todos
    .filter(
      (todo) =>
        !todo.archived &&
        !todo.completed &&
        todo.repeat === "NONE" &&
        todo.date < plannerToday,
    )
    .sort((a, b) => a.date.localeCompare(b.date) || b.createdAt.localeCompare(a.createdAt));
}

export function getDuplicateTodoGroups(todos: Todo[]): DuplicateTodoGroup[] {
  const groups = new Map<string, Todo[]>();
  todos
    .filter((todo) => !todo.archived && todo.repeat === "NONE")
    .forEach((todo) => {
      const key = getTodoDuplicateKey(todo);
      groups.set(key, [...(groups.get(key) || []), todo]);
    });

  return [...groups.entries()]
    .filter(([, groupTodos]) => groupTodos.length > 1)
    .map(([key, groupTodos]) => ({
      key,
      todos: [...groupTodos].sort(
        (a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt),
      ),
    }));
}

export function getDuplicateTodoIds(todos: Todo[]): Set<string> {
  return new Set(getDuplicateTodoGroups(todos).flatMap((group) => group.todos.map((todo) => todo.id)));
}

export function buildDefaultOverdueSelection(todos: Todo[]): Set<string> {
  const duplicateGroups = getDuplicateTodoGroups(todos);
  const duplicateIds = new Set(duplicateGroups.flatMap((group) => group.todos.map((todo) => todo.id)));
  const selected = new Set(todos.filter((todo) => !duplicateIds.has(todo.id)).map((todo) => todo.id));
  duplicateGroups.forEach((group) => {
    if (group.todos[0]) selected.add(group.todos[0].id);
  });
  return selected;
}

export async function importSelectedOverdueTodos({
  overdueTodos,
  selectedIds,
  todayTodos,
  mode,
  copyTodo,
  moveTodo,
}: {
  overdueTodos: Todo[];
  selectedIds: ReadonlySet<string>;
  todayTodos: Todo[];
  mode: OverdueTodoImportMode;
  copyTodo: (todo: Todo) => Promise<boolean>;
  moveTodo: (todo: Todo) => Promise<boolean>;
}): Promise<OverdueTodoImportResult> {
  const selectedTodos = overdueTodos.filter((todo) => selectedIds.has(todo.id));
  const todayKeys = new Set(
    todayTodos
      .filter((todo) => !todo.archived)
      .map(getTodoDuplicateKey),
  );
  let success = 0;
  let skipped = 0;
  let failed = 0;

  for (const todo of selectedTodos) {
    if (todayKeys.has(getTodoDuplicateKey(todo))) {
      skipped += 1;
      continue;
    }
    try {
      const completed = mode === "copy" ? await copyTodo(todo) : await moveTodo(todo);
      if (completed) success += 1;
      else failed += 1;
    } catch {
      failed += 1;
    }
  }

  return { total: selectedTodos.length, success, skipped, failed, mode };
}
