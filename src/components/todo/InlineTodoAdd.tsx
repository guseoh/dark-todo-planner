import type { Todo, TodoInput } from "../../types/todo";
import { TodoForm } from "./TodoForm";
import { useTodoQuickActions } from "./TodoQuickActionsContext";

type InlineTodoAddProps = {
  categoryId?: string;
  defaultDate?: string;
  layout?: "inline" | "stacked";
  placeholder?: string;
  onAdd: (todo: TodoInput) => Promise<Todo | undefined> | Todo | undefined;
  onCancel: () => void;
};

export function InlineTodoAdd({ categoryId, defaultDate, layout, placeholder, onAdd, onCancel }: InlineTodoAddProps) {
  const context = useTodoQuickActions();
  return <TodoForm compact autoFocus layout={layout} placeholder={placeholder} defaultDate={defaultDate}
    defaultCategoryId={categoryId} lockCategory={Boolean(categoryId)} categories={context?.categories}
    projects={context?.projects} onAdd={onAdd} onCancel={onCancel} />;
}
