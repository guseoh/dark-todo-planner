import { createContext, useContext, type ReactNode } from "react";
import type { Todo } from "../../types/todo";

export type TodoSnoozeTarget =
  | { type: "DATE"; date: string }
  | { type: "SOMEDAY" };

type TodoQuickActionsContextValue = {
  snoozeTodo: (todo: Todo, target: TodoSnoozeTarget) => Promise<boolean>;
};

const TodoQuickActionsContext = createContext<TodoQuickActionsContextValue | null>(null);

export function TodoQuickActionsProvider({
  snoozeTodo,
  children,
}: TodoQuickActionsContextValue & { children: ReactNode }) {
  return (
    <TodoQuickActionsContext.Provider value={{ snoozeTodo }}>
      {children}
    </TodoQuickActionsContext.Provider>
  );
}

export const useTodoQuickActions = () => useContext(TodoQuickActionsContext);
