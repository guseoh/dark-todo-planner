import { createContext, useContext, type ReactNode } from "react";
import type { Project } from "../../types/project";
import type { Category } from "../../types/category";
import type { Todo } from "../../types/todo";

export type TodoSnoozeTarget =
  | { type: "DATE"; date: string }
  | { type: "SOMEDAY" };

type TodoQuickActionsContextValue = {
  projects: Project[];
  categories: Category[];
  snoozeTodo: (todo: Todo, target: TodoSnoozeTarget) => Promise<boolean>;
};

const TodoQuickActionsContext = createContext<TodoQuickActionsContextValue | null>(null);

export function TodoQuickActionsProvider({
  snoozeTodo, projects, categories,
  children,
}: TodoQuickActionsContextValue & { children: ReactNode }) {
  return (
    <TodoQuickActionsContext.Provider value={{ snoozeTodo, projects, categories }}>
      {children}
    </TodoQuickActionsContext.Provider>
  );
}

export const useTodoQuickActions = () => useContext(TodoQuickActionsContext);
