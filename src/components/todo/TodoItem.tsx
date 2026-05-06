import { CalendarDays, CheckCircle2, Clock3, Pencil, Trash2 } from "lucide-react";
import { formatKoreanDate } from "../../lib/date";
import type { Todo } from "../../types/todo";
import { PriorityBadge } from "./PriorityBadge";

type TodoItemProps = {
  todo: Todo;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit: (todo: Todo) => void;
  showDate?: boolean;
};

export function TodoItem({ todo, onToggle, onDelete, onEdit, showDate = true }: TodoItemProps) {
  const handleDelete = () => {
    if (window.confirm(`"${todo.title}" Todo를 삭제할까요?`)) {
      onDelete(todo.id);
    }
  };

  return (
    <article className={`rounded-lg border border-ink-700 bg-ink-950/50 p-4 transition hover:border-ink-500 ${todo.completed ? "opacity-60" : ""}`}>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => onToggle(todo.id)}
          className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border transition ${
            todo.completed
              ? "border-emerald-400 bg-emerald-400 text-ink-950"
              : "border-ink-600 text-transparent hover:border-accent-500"
          }`}
          aria-label={todo.completed ? "미완료로 변경" : "완료로 변경"}
        >
          <CheckCircle2 size={16} />
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className={`break-words text-base font-semibold text-ink-100 ${todo.completed ? "text-ink-500 line-through" : ""}`}>
              {todo.title}
            </h3>
            <PriorityBadge priority={todo.priority} />
          </div>
          {todo.memo ? <p className="mt-2 whitespace-pre-wrap text-sm text-ink-400">{todo.memo}</p> : null}
          <div className="mt-3 flex flex-wrap gap-3 text-xs text-ink-500">
            {showDate ? (
              <span className="inline-flex items-center gap-1">
                <CalendarDays size={14} />
                {formatKoreanDate(todo.date, "M월 d일 E")}
              </span>
            ) : null}
            {todo.startTime || todo.endTime ? (
              <span className="inline-flex items-center gap-1">
                <Clock3 size={14} />
                {todo.startTime || "--:--"} - {todo.endTime || "--:--"}
              </span>
            ) : null}
          </div>
        </div>

        <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
          <button type="button" className="icon-btn" onClick={() => onEdit(todo)} aria-label="Todo 수정">
            <Pencil size={16} />
          </button>
          <button type="button" className="icon-btn hover:border-red-400 hover:text-red-200" onClick={handleDelete} aria-label="Todo 삭제">
            <Trash2 size={16} />
          </button>
        </div>
      </div>
    </article>
  );
}
