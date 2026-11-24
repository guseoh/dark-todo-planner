import { createContext, useCallback, useContext, useMemo, useRef, type ReactNode } from "react";
import type { Project } from "../../types/project";
import type { Category } from "../../types/category";
import type { Todo, TodoInput } from "../../types/todo";

export type TodoSnoozeTarget =
  | { type: "DATE"; date: string }
  | { type: "SOMEDAY" };

type TodoQuickActionsContextValue = {
  projects: Project[];
  categories: Category[];
  updateTodo?: (id: string, updates: Partial<Todo>) => Promise<Todo | undefined>;
  addTodo?: (input: TodoInput) => Promise<Todo | undefined> | Todo | undefined;
  snoozeTodo: (todo: Todo, target: TodoSnoozeTarget) => Promise<boolean>;
};

const TodoQuickActionsContext = createContext<TodoQuickActionsContextValue | null>(null);

export function TodoQuickActionsProvider({
  snoozeTodo, addTodo, updateTodo, projects, categories,
  children,
}: TodoQuickActionsContextValue & { children: ReactNode }) {
  // Every Todo row reads this context: keep the value stable so unrelated App renders do not redraw all rows.
  const snoozeRef = useRef(snoozeTodo);
  snoozeRef.current = snoozeTodo;
  const stableSnooze = useCallback((todo: Todo, target: TodoSnoozeTarget) => snoozeRef.current(todo, target), []);
  const updateRef = useRef(updateTodo);
  updateRef.current = updateTodo;
  const stableUpdate = useCallback((id: string, updates: Partial<Todo>) => updateRef.current?.(id, updates) ?? Promise.resolve(undefined), []);
  const value = useMemo(() => ({ snoozeTodo: stableSnooze, addTodo, updateTodo: stableUpdate, projects, categories }), [stableSnooze, addTodo, stableUpdate, projects, categories]);
  return (
    <TodoQuickActionsContext.Provider value={value}>
      {children}
    </TodoQuickActionsContext.Provider>
  );
}

export const useTodoQuickActions = () => useContext(TodoQuickActionsContext);
