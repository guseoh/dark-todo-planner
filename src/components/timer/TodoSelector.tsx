import type { Todo } from "../../types/todo";

export function TodoSelector({
  todos,
  selectedTodoId,
  onSelect,
}: {
  todos: Todo[];
  selectedTodoId?: string;
  onSelect: (todo?: Todo) => void;
}) {
  const activeTodos = todos.filter((todo) => !todo.completed && !todo.archived);

  return (
    <section className="app-card p-5">
      <h3 className="text-lg font-bold text-ink-100">집중할 Todo 선택</h3>
      <select
        className="field mt-4"
        value={selectedTodoId || ""}
        onChange={(event) => {
          const todo = activeTodos.find((item) => item.id === event.target.value);
          onSelect(todo);
        }}
      >
        <option value="">선택하지 않고 시작</option>
        {activeTodos.map((todo) => (
          <option key={todo.id} value={todo.id}>
            {todo.title}
          </option>
        ))}
      </select>
    </section>
  );
}
