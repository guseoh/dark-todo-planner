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
  addTodo?: (input: TodoInput) => Promise<Todo | undefined> | Todo | undefined;
  snoozeTodo: (todo: Todo, target: TodoSnoozeTarget) => Promise<boolean>;
};

const TodoQuickActionsContext = createContext<TodoQuickActionsContextValue | null>(null);

export function TodoQuickActionsProvider({
  snoozeTodo, addTodo, projects, categories,
  children,
}: TodoQuickActionsContextValue & { children: ReactNode }) {
  // Every Todo row reads this context: keep the value stable so unrelated App renders do not redraw all rows.
  const snoozeRef = useRef(snoozeTodo);
  snoozeRef.current = snoozeTodo;
  const stableSnooze = useCallback((todo: Todo, target: TodoSnoozeTarget) => snoozeRef.current(todo, target), []);
  const value = useMemo(() => ({ snoozeTodo: stableSnooze, addTodo, projects, categories }), [stableSnooze, addTodo, projects, categories]);
  return (
    <TodoQuickActionsContext.Provider value={value}>
      {children}
    </TodoQuickActionsContext.Provider>
  );
}

export const useTodoQuickActions = () => useContext(TodoQuickActionsContext);
