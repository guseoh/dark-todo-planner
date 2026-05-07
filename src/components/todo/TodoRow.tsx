import { Archive, CalendarDays, CheckCircle2, Pencil, Play, RotateCcw, Trash2 } from "lucide-react";
import { formatKoreanDate } from "../../lib/date";
import { repeatLabel } from "../../lib/todo";
import type { Todo } from "../../types/todo";
import { PriorityBadge } from "./PriorityBadge";

type TodoRowProps = {
  todo: Todo;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit: (todo: Todo) => void;
  onArchive?: (id: string) => void;
  onUnarchive?: (id: string) => void;
  onFocusTodo?: (todo: Todo) => void;
  showDate?: boolean;
  showCategoryBadge?: boolean;
};

export function TodoRow({
  todo,
  onToggle,
  onDelete,
  onEdit,
  onArchive,
  onUnarchive,
  onFocusTodo,
  showDate = true,
  showCategoryBadge = true,
}: TodoRowProps) {
  const handleDelete = () => {
    if (window.confirm(`"${todo.title}" Todo를 삭제할까요?`)) {
      onDelete(todo.id);
    }
  };

  return (
    <article
      className={`group rounded-lg border border-ink-800 bg-ink-950/35 px-2.5 py-1.5 transition hover:border-ink-600 hover:bg-ink-900/70 sm:px-3 ${
        todo.completed ? "opacity-60" : ""
      }`}
    >
      <div className="flex min-w-0 items-center gap-2">
        <button
          type="button"
          onClick={() => onToggle(todo.id)}
          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition ${
            todo.completed
              ? "border-success bg-success text-ink-950"
              : "border-ink-600 text-transparent hover:border-accent-400"
          }`}
          aria-label={todo.completed ? "미완료로 변경" : "완료로 변경"}
        >
          <CheckCircle2 size={13} />
        </button>

        <button type="button" className="min-w-0 flex-1 text-left" onClick={() => onEdit(todo)}>
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <h4 className={`min-w-0 break-words text-sm font-semibold leading-5 text-ink-100 ${todo.completed ? "text-ink-500 line-through" : ""}`}>
              {todo.title}
            </h4>
            <PriorityBadge priority={todo.priority} compact />
            {showCategoryBadge ? (
              <span className="rounded-full border border-ink-700 bg-ink-900 px-2 py-0.5 text-[11px] font-semibold leading-4 text-ink-300">
                {todo.category?.name || "미분류"}
              </span>
            ) : null}
            {todo.repeat !== "NONE" ? (
              <span className="rounded-full border border-accent-500/35 bg-accent-500/15 px-2 py-0.5 text-[11px] font-semibold leading-4 text-indigo-100">
                {repeatLabel[todo.repeat]}
              </span>
            ) : null}
            {todo.archived ? (
              <span className="rounded-full border border-ink-600 bg-ink-700/60 px-2 py-0.5 text-[11px] font-semibold leading-4 text-ink-200">
                보관됨
              </span>
            ) : null}
          </div>
          {todo.memo ? <p className="mt-0.5 line-clamp-1 whitespace-pre-wrap text-[11px] text-ink-500">{todo.memo}</p> : null}
          <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-ink-500">
            {showDate ? (
              <span className="inline-flex items-center gap-1">
                <CalendarDays size={13} />
                {formatKoreanDate(todo.date, "M월 d일 E")}
              </span>
            ) : null}
            {todo.tags.map((tag) => (
              <span key={tag} className="rounded-full border border-ink-700 px-2 py-0.5 text-ink-400">
                #{tag}
              </span>
            ))}
          </div>
        </button>

        <div className="flex shrink-0 flex-wrap justify-end gap-1 opacity-100 sm:opacity-70 sm:transition sm:group-hover:opacity-100">
          {onFocusTodo && !todo.archived ? (
            <button type="button" className="icon-btn min-h-7 min-w-7 rounded-md" onClick={() => onFocusTodo(todo)} aria-label="집중 시작">
              <Play size={13} />
            </button>
          ) : null}
          {todo.archived && onUnarchive ? (
            <button type="button" className="icon-btn min-h-7 min-w-7 rounded-md" onClick={() => onUnarchive(todo.id)} aria-label="보관 해제">
              <RotateCcw size={13} />
            </button>
          ) : null}
          {!todo.archived && todo.completed && onArchive ? (
            <button type="button" className="icon-btn min-h-7 min-w-7 rounded-md" onClick={() => onArchive(todo.id)} aria-label="Todo 보관">
              <Archive size={13} />
            </button>
          ) : null}
          <button type="button" className="icon-btn min-h-7 min-w-7 rounded-md" onClick={() => onEdit(todo)} aria-label="Todo 수정">
            <Pencil size={13} />
          </button>
          <button type="button" className="icon-btn min-h-7 min-w-7 rounded-md hover:border-red-400 hover:text-red-200" onClick={handleDelete} aria-label="Todo 삭제">
            <Trash2 size={13} />
          </button>
        </div>
      </div>
    </article>
  );
}
