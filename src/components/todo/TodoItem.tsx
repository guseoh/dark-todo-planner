import { Archive, CalendarDays, CheckCircle2, Pencil, RotateCcw, Trash2 } from "lucide-react";
import { formatKoreanDate, getDdayLabel, todayKey } from "../../lib/date";
import { isDueSoon, isOverdueByDeadline } from "../../lib/todo";
import { planningStateLabels } from "../../lib/todoLabels";
import type { Todo } from "../../types/todo";
import { MarkdownPreview } from "../editor/MarkdownPreview";
import { PriorityBadge } from "./PriorityBadge";

type TodoItemProps = {
  todo: Todo;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit: (todo: Todo) => void;
  onArchive?: (id: string) => void;
  onUnarchive?: (id: string) => void;
  showDate?: boolean;
};

const planningLabel = planningStateLabels;

export function TodoItem({ todo, onToggle, onDelete, onEdit, onArchive, onUnarchive, showDate = true }: TodoItemProps) {
  const handleDelete = () => {
    if (window.confirm(`"${todo.title}" Todo를 삭제할까요?`)) onDelete(todo.id);
  };
  const today = todayKey();
  const overdue = isOverdueByDeadline(todo, today);
  const dueSoon = isDueSoon(todo, today);

  return (
    <article className={`border-b border-ink-700/40 bg-transparent px-2 py-3 transition hover:bg-ink-850/50 ${todo.completed ? "opacity-60" : ""}`}>
      <div className="flex gap-3">
        <button type="button" onClick={() => onToggle(todo.id)} className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-[4px] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/70 ${todo.completed ? "text-success" : "text-ink-600 hover:bg-ink-800 hover:text-ink-300"}`} aria-label={todo.completed ? "미완료로 변경" : "완료로 변경"}><CheckCircle2 size={20} /></button>

        <div className="min-w-0 flex-1">
          <h3 className={`break-words text-base font-semibold text-ink-100 ${todo.completed ? "text-ink-500 line-through" : ""}`}>{todo.title}</h3>
          {todo.memo ? <MarkdownPreview className="mt-2" value={todo.memo} /> : null}
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-500">
            <PriorityBadge priority={todo.priority} />
            <span>{todo.category?.name || "미분류"}</span>
            {todo.planningState !== "SCHEDULED" ? <span>{planningLabel[todo.planningState]}</span> : null}
            {todo.archived ? <span>보관됨</span> : null}
            {showDate && todo.planningState === "SCHEDULED" ? <span className="inline-flex items-center gap-1"><CalendarDays size={14} />{formatKoreanDate(todo.date, "M월 d일 E")}</span> : null}
            {todo.dueDate ? <span className={`font-medium ${overdue ? "text-red-200" : dueSoon ? "text-amber-200" : "text-ink-400"}`}>마감 {formatKoreanDate(todo.dueDate, "M/d")} · {getDdayLabel(todo.dueDate)}</span> : null}
          </div>
        </div>

        <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
          {todo.archived && onUnarchive ? <button type="button" className="icon-btn min-h-9 min-w-9" onClick={() => onUnarchive(todo.id)} aria-label="보관 해제"><RotateCcw size={16} /></button> : null}
          {!todo.archived && todo.completed && onArchive ? <button type="button" className="icon-btn min-h-9 min-w-9" onClick={() => onArchive(todo.id)} aria-label="Todo 보관"><Archive size={16} /></button> : null}
          <button type="button" className="icon-btn min-h-9 min-w-9" onClick={() => onEdit(todo)} aria-label="Todo 수정"><Pencil size={16} /></button>
          <button type="button" className="icon-btn min-h-9 min-w-9 hover:text-red-200" onClick={handleDelete} aria-label="Todo 삭제"><Trash2 size={16} /></button>
        </div>
      </div>
    </article>
  );
}
