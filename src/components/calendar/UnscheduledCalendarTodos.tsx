import type { Todo } from "../../types/todo";

export function UnscheduledCalendarTodos({ todos }: { todos: Todo[] }) {
  const unscheduled = todos.filter((todo) => !todo.completed && !todo.archived && (todo.planningState === "SOMEDAY" || todo.planningState === "WAITING"));
  return (
    <section className="calendar-unscheduled" aria-label="날짜 미정">
      <h3 className="mb-2 text-[13px] font-semibold">날짜 미정</h3>
      {unscheduled.length ? <ul className="space-y-1">
        {unscheduled.map((todo) => <li key={todo.id} draggable onDragStart={(event) => {
          event.dataTransfer.effectAllowed = "move";
          event.dataTransfer.setData("text/plain", todo.id);
        }} className="cursor-grab truncate rounded-md bg-ui-surface px-2 py-1.5 text-xs" title={todo.title}>{todo.title}</li>)}
      </ul> : <p className="text-xs text-ui-muted">날짜 미정 작업이 없습니다.</p>}
    </section>
  );
}
