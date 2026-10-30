import { Archive, CalendarDays, CheckCircle2, ExternalLink, FolderKanban, Pencil, RotateCcw, Tag, Trash2 } from "lucide-react";
import type { ReactNode } from "react";
import { formatKoreanDate, getDdayLabel, todayKey } from "../../lib/date";
import { isDueSoon, isOverdueByDeadline } from "../../lib/todo";
import { planningStateLabels, workflowStatusLabels } from "../../lib/todoLabels";
import type { Todo } from "../../types/todo";
import { PriorityBadge } from "./PriorityBadge";
import { QuickSnoozeMenu } from "./QuickSnoozeMenu";

type TodoRowProps = {
  todo: Todo;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit: (todo: Todo) => void;
  onArchive?: (id: string) => void;
  onUnarchive?: (id: string) => void;
  showDate?: boolean;
  showCategoryBadge?: boolean;
  showCategoryMeta?: boolean;
  projectName?: string;
  leadingAction?: ReactNode;
  variant?: "default" | "today";
  hideMediumPriority?: boolean;
  duplicateCandidate?: boolean;
  selectionMode?: boolean;
  selected?: boolean;
  onSelect?: (id: string) => void;
};

const planningLabel = planningStateLabels;

export function TodoRow({
  todo,
  onToggle,
  onDelete,
  onEdit,
  onArchive,
  onUnarchive,
  showDate = true,
  showCategoryBadge = true,
  showCategoryMeta = false,
  projectName,
  leadingAction,
  variant = "default",
  hideMediumPriority = false,
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
    <article className={`todo-row ${variant === "today" ? "todo-row--today" : ""} group px-1 py-3 transition-colors sm:px-2 ${selected && selectionMode ? "bg-ui-selected" : "bg-transparent hover:bg-ui-hover"}`}>
      <div className="flex min-w-0 items-start gap-1.5 sm:gap-2">
        {leadingAction ? <div className="flex h-10 w-10 shrink-0 items-center justify-center">{leadingAction}</div> : null}
        {selectionMode ? (
          <label className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-[4px] transition-colors hover:bg-ui-hover" title={selected ? "선택 해제" : "선택"}>
            <input type="checkbox" className="h-4 w-4 accent-accent-500" checked={selected} onChange={() => onSelect?.(todo.id)} aria-label={`"${todo.title}" 선택`} />
          </label>
        ) : (
          <button type="button" onClick={() => onToggle(todo.id)} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[4px] transition-colors hover:bg-ui-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ui-focus" aria-label={todo.completed ? `"${todo.title}" 미완료로 변경` : `"${todo.title}" 완료로 변경`} title={todo.completed ? "미완료로 변경" : "완료로 변경"}>
            <span className={`flex h-5 w-5 items-center justify-center rounded-full border transition ${todo.completed ? "border-success bg-success text-ink-950" : "border-ink-600 text-transparent"}`} aria-hidden="true"><CheckCircle2 size={13} /></span>
          </button>
        )}

        <button type="button" className="min-w-0 flex-1 rounded-[4px] px-1 py-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ui-focus" onClick={openOrSelect} aria-pressed={selectionMode ? selected : undefined}>
          <h4 className={`min-w-0 break-words text-[15px] font-semibold leading-6 tracking-[-0.01em] text-ui-text ${todo.completed ? "text-ui-muted line-through" : ""}`}>{todo.title}</h4>
          {todo.memo ? <p className="mt-1 line-clamp-2 whitespace-pre-wrap text-[13px] leading-5 text-ui-secondary">{todo.memo}</p> : null}
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ui-secondary">
            {!(hideMediumPriority && todo.priority === "MEDIUM") ? <PriorityBadge priority={todo.priority} compact /> : null}
            {!todo.completed && (todo.workflowStatus === "IN_PROGRESS" || todo.workflowStatus === "BLOCKED") ? <span className={todo.workflowStatus === "BLOCKED" ? "font-medium text-danger" : "text-ink-300"}>{workflowStatusLabels[todo.workflowStatus]}</span> : null}
            {showCategoryBadge ? <span>{todo.category?.name || "미분류"}</span> : null}
            {todo.planningState !== "SCHEDULED" ? <span>{planningLabel[todo.planningState]}</span> : null}
            {todo.archived ? <span>보관됨</span> : null}
            {duplicateCandidate ? <span className="font-medium text-warning">중복 후보</span> : null}
            {projectName ? <span className="inline-flex items-center gap-1 font-medium text-ui-secondary">{variant === "today" ? <FolderKanban size={12} aria-hidden="true" /> : null}{projectName}</span> : null}
            {showCategoryMeta && !showCategoryBadge ? <span className="inline-flex items-center gap-1">{variant === "today" ? <Tag size={12} aria-hidden="true" /> : null}{todo.category?.name || "미분류"}</span> : null}
            {showDate && todo.planningState === "SCHEDULED" ? <span className="inline-flex items-center gap-1"><CalendarDays size={12} />{formatKoreanDate(todo.date, "M월 d일 E")}</span> : null}
            {todo.dueDate ? <span className={`font-medium ${overdue ? "text-danger" : dueSoon ? "text-warning" : "text-ink-400"}`}>마감 {formatKoreanDate(todo.dueDate, "M/d")} · {getDdayLabel(todo.dueDate)}</span> : null}
            {todo.referenceUrl ? <span className="inline-flex items-center gap-1 font-semibold text-accent-200"><ExternalLink size={11} />{todo.referenceLabel || "관련 링크"}</span> : null}
          </div>
        </button>

        {!selectionMode ? (
          <div className="flex shrink-0 flex-wrap justify-end gap-0.5 opacity-100 sm:opacity-65 sm:transition-opacity sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
            <QuickSnoozeMenu todo={todo} />
            {todo.referenceUrl ? <a href={todo.referenceUrl} target="_blank" rel="noreferrer" className="icon-btn h-8 w-8" aria-label={`"${todo.title}" 관련 링크 열기`} title={todo.referenceLabel || "관련 링크 열기"}><ExternalLink size={13} /></a> : null}
            {todo.archived && onUnarchive ? <button type="button" className="icon-btn h-8 w-8" onClick={() => onUnarchive(todo.id)} aria-label={`"${todo.title}" 보관 해제`}><RotateCcw size={13} /></button> : null}
            {!todo.archived && todo.completed && onArchive ? <button type="button" className="icon-btn h-8 w-8" onClick={() => onArchive(todo.id)} aria-label={`"${todo.title}" Todo 보관`}><Archive size={13} /></button> : null}
            <button type="button" className="icon-btn h-8 w-8" onClick={() => onEdit(todo)} aria-label={`"${todo.title}" Todo 수정`}><Pencil size={13} /></button>
            <button type="button" className="icon-btn h-8 w-8 hover:border-danger hover:text-danger" onClick={handleDelete} aria-label={`"${todo.title}" Todo 삭제`}><Trash2 size={13} /></button>
          </div>
        ) : null}
      </div>
    </article>
  );
}
