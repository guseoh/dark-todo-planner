import { Archive, CalendarDays, CheckCircle2, Clock3, Pencil, Play, RotateCcw, Trash2 } from "lucide-react";
import { formatKoreanDate } from "../../lib/date";
import { repeatLabel } from "../../lib/todo";
import type { Todo } from "../../types/todo";
import { PriorityBadge } from "./PriorityBadge";

type TodoItemProps = {
  todo: Todo;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit: (todo: Todo) => void;
  onArchive?: (id: string) => void;
  onUnarchive?: (id: string) => void;
  onFocusTodo?: (todo: Todo) => void;
  showDate?: boolean;
};

export function TodoItem({
  todo,
  onToggle,
  onDelete,
  onEdit,
  onArchive,
  onUnarchive,
  onFocusTodo,
  showDate = true,
}: TodoItemProps) {
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
            {todo.repeat !== "NONE" ? (
              <span className="rounded-full border border-accent-500/35 bg-accent-500/15 px-2.5 py-1 text-xs font-semibold text-indigo-100">
                {repeatLabel[todo.repeat]}
              </span>
            ) : null}
            {todo.archived ? (
              <span className="rounded-full border border-ink-600 bg-ink-700/60 px-2.5 py-1 text-xs font-semibold text-ink-200">
                보관됨
              </span>
            ) : null}
          </div>
          {todo.memo ? <p className="mt-2 whitespace-pre-wrap text-sm text-ink-400">{todo.memo}</p> : null}
          {todo.tags.length ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {todo.tags.map((tag) => (
                <span key={tag} className="rounded-full border border-ink-600 bg-ink-800 px-2.5 py-1 text-xs text-ink-300">
                  #{tag}
                </span>
              ))}
            </div>
          ) : null}
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
          {onFocusTodo && !todo.archived ? (
            <button type="button" className="icon-btn" onClick={() => onFocusTodo(todo)} aria-label="집중 시작">
              <Play size={16} />
            </button>
          ) : null}
          {todo.archived && onUnarchive ? (
            <button type="button" className="icon-btn" onClick={() => onUnarchive(todo.id)} aria-label="보관 해제">
              <RotateCcw size={16} />
            </button>
          ) : null}
          {!todo.archived && todo.completed && onArchive ? (
            <button type="button" className="icon-btn" onClick={() => onArchive(todo.id)} aria-label="Todo 보관">
              <Archive size={16} />
            </button>
          ) : null}
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
