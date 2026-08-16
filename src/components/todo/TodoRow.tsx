import { Archive, CalendarDays, CheckCircle2, Pencil, RotateCcw, Trash2 } from "lucide-react";
import { formatKoreanDate, getDdayLabel, todayKey } from "../../lib/date";
import { isDueSoon, isOverdueByDeadline, repeatLabel } from "../../lib/todo";
import type { Todo } from "../../types/todo";
import { PriorityBadge } from "./PriorityBadge";

type TodoRowProps = {
  todo: Todo;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit: (todo: Todo) => void;
  onArchive?: (id: string) => void;
  onUnarchive?: (id: string) => void;
  showDate?: boolean;
  showCategoryBadge?: boolean;
  duplicateCandidate?: boolean;
  selectionMode?: boolean;
  selected?: boolean;
  onSelect?: (id: string) => void;
};

const planningLabel = { INBOX: "Inbox", SCHEDULED: "일정", SOMEDAY: "Someday", WAITING: "Waiting" } as const;

export function TodoRow({
  todo,
  onToggle,
  onDelete,
  onEdit,
  onArchive,
  onUnarchive,
  showDate = true,
  showCategoryBadge = true,
  duplicateCandidate = false,
  selectionMode = false,
  selected = false,
  onSelect,
}: TodoRowProps) {
  const handleDelete = () => {
    if (window.confirm(`"${todo.title}" Todo를 삭제할까요?`)) onDelete(todo.id);
  };
  const today = todayKey();
  const overdue = isOverdueByDeadline(todo, today);
  const dueSoon = isDueSoon(todo, today);
  const openOrSelect = () => selectionMode ? onSelect?.(todo.id) : onEdit(todo);

  return (
    <article className={`group rounded-md border px-2 py-1.5 transition sm:px-2.5 ${selected && selectionMode ? "border-accent-500/55 bg-accent-500/10" : "border-ink-800/90 bg-ink-950/32 hover:border-ink-600 hover:bg-ink-900/65"} ${todo.completed ? "opacity-65" : ""}`}>
      <div className="flex min-w-0 items-center gap-1.5">
        {selectionMode ? (
          <label className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-md transition hover:bg-ink-800" title={selected ? "선택 해제" : "선택"}>
            <input type="checkbox" className="h-4 w-4 accent-accent-500" checked={selected} onChange={() => onSelect?.(todo.id)} aria-label={`"${todo.title}" 선택`} />
          </label>
        ) : (
          <button type="button" onClick={() => onToggle(todo.id)} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md transition hover:bg-ink-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/40" aria-label={todo.completed ? `"${todo.title}" 미완료로 변경` : `"${todo.title}" 완료로 변경`} title={todo.completed ? "미완료로 변경" : "완료로 변경"}>
            <span className={`flex h-5 w-5 items-center justify-center rounded-full border transition ${todo.completed ? "border-success bg-success text-ink-950" : "border-ink-600 text-transparent"}`} aria-hidden="true"><CheckCircle2 size={13} /></span>
          </button>
        )}

        <button type="button" className="min-w-0 flex-1 rounded-md px-1 py-0.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/30" onClick={openOrSelect} aria-pressed={selectionMode ? selected : undefined}>
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            <h4 className={`min-w-0 break-words text-sm font-semibold leading-5 text-ink-100 ${todo.completed ? "text-ink-500 line-through" : ""}`}>{todo.title}</h4>
            <PriorityBadge priority={todo.priority} compact />
            {showCategoryBadge ? <span className="rounded-full border border-ink-700/70 bg-ink-900 px-1.5 py-0.5 text-[10px] font-semibold leading-4 text-ink-400">{todo.category?.name || "미분류"}</span> : null}
            {todo.planningState !== "SCHEDULED" ? <span className="rounded-full border border-sky-400/25 bg-sky-400/10 px-1.5 py-0.5 text-[10px] font-semibold leading-4 text-sky-100">{planningLabel[todo.planningState]}</span> : null}
            {todo.repeat !== "NONE" ? <span className="rounded-full border border-accent-500/30 bg-accent-500/12 px-1.5 py-0.5 text-[10px] font-semibold leading-4 text-indigo-100">{repeatLabel[todo.repeat]}</span> : null}
            {todo.archived ? <span className="rounded-full border border-ink-600 bg-ink-700/45 px-1.5 py-0.5 text-[10px] font-semibold leading-4 text-ink-300">보관됨</span> : null}
            {duplicateCandidate ? <span className="rounded-full border border-amber-400/35 bg-amber-400/10 px-1.5 py-0.5 text-[10px] font-semibold leading-4 text-amber-100">중복 후보</span> : null}
          </div>
          {todo.memo ? <p className="mt-0.5 line-clamp-1 whitespace-pre-wrap text-[11px] text-ink-500">{todo.memo}</p> : null}
          <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[10px] text-ink-500">
            {showDate && todo.planningState === "SCHEDULED" ? <span className="inline-flex items-center gap-1"><CalendarDays size={12} />{formatKoreanDate(todo.date, "M월 d일 E")}</span> : null}
            {todo.estimateMinutes ? <span>예상 {todo.estimateMinutes}분</span> : null}
            {todo.dueDate ? <span className={`rounded-full border px-1.5 py-0.5 font-semibold ${overdue ? "border-danger/40 bg-danger/10 text-red-100" : dueSoon ? "border-warning/40 bg-warning/10 text-amber-100" : "border-ink-700/70 text-ink-400"}`}>마감 {formatKoreanDate(todo.dueDate, "M/d")} · {getDdayLabel(todo.dueDate)}</span> : null}
            {todo.tags.map((tag) => <span key={tag}>#{tag}</span>)}
          </div>
        </button>

        {!selectionMode ? (
          <div className="flex shrink-0 flex-wrap justify-end gap-1 opacity-100 sm:opacity-60 sm:transition sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
            {todo.archived && onUnarchive ? <button type="button" className="icon-btn h-8 w-8" onClick={() => onUnarchive(todo.id)} aria-label={`"${todo.title}" 보관 해제`}><RotateCcw size={13} /></button> : null}
            {!todo.archived && todo.completed && onArchive ? <button type="button" className="icon-btn h-8 w-8" onClick={() => onArchive(todo.id)} aria-label={`"${todo.title}" Todo 보관`}><Archive size={13} /></button> : null}
            <button type="button" className="icon-btn h-8 w-8" onClick={() => onEdit(todo)} aria-label={`"${todo.title}" Todo 수정`}><Pencil size={13} /></button>
            <button type="button" className="icon-btn h-8 w-8 hover:border-red-400 hover:text-red-200" onClick={handleDelete} aria-label={`"${todo.title}" Todo 삭제`}><Trash2 size={13} /></button>
          </div>
        ) : null}
      </div>
    </article>
  );
}
