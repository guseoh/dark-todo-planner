import { useMemo, useState } from "react";
import { sortByTime } from "../../lib/todo";
import type { Todo } from "../../types/todo";
import { EmptyState } from "../common/EmptyState";
import { TodoEditModal } from "./TodoEditModal";
import { TodoItem } from "./TodoItem";

type TodoListProps = {
  todos: Todo[];
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onUpdate: (id: string, updates: Partial<Omit<Todo, "id" | "createdAt">>) => void;
  emptyTitle: string;
  emptyDescription?: string;
  groupByCompletion?: boolean;
  showDate?: boolean;
};

export function TodoList({
  todos,
  onToggle,
  onDelete,
  onUpdate,
  emptyTitle,
  emptyDescription,
  groupByCompletion = false,
  showDate = true,
}: TodoListProps) {
  const [editingTodo, setEditingTodo] = useState<Todo | null>(null);
  const sortedTodos = useMemo(() => sortByTime(todos), [todos]);
  const activeTodos = sortedTodos.filter((todo) => !todo.completed);
  const completedTodos = sortedTodos.filter((todo) => todo.completed);

  if (todos.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }

  const renderItems = (items: Todo[]) => (
    <div className="space-y-3">
      {items.map((todo) => (
        <TodoItem
          key={todo.id}
          todo={todo}
          onToggle={onToggle}
          onDelete={onDelete}
          onEdit={setEditingTodo}
          showDate={showDate}
        />
      ))}
    </div>
  );

  return (
    <>
      {groupByCompletion ? (
        <div className="space-y-6">
          <section>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-ink-300">미완료</h3>
              <span className="text-xs text-ink-500">{activeTodos.length}개</span>
            </div>
            {activeTodos.length ? renderItems(activeTodos) : <EmptyState title="남은 Todo가 없습니다." />}
          </section>
          <section>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-ink-300">완료</h3>
              <span className="text-xs text-ink-500">{completedTodos.length}개</span>
            </div>
            {completedTodos.length ? renderItems(completedTodos) : <EmptyState title="완료한 Todo가 없습니다." />}
          </section>
        </div>
      ) : (
        renderItems(sortedTodos)
      )}

      <TodoEditModal todo={editingTodo} onClose={() => setEditingTodo(null)} onSave={onUpdate} />
    </>
  );
}
