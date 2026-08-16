import { ChevronDown, Pencil, Plus, Trash2 } from "lucide-react";
import type { ReactNode } from "react";
import type { Category } from "../../types/category";
import { ProgressBar } from "../common/ProgressBar";
import { CategoryIcon } from "./CategoryIcon";
import { formatCompletionRate } from "../../lib/todo";

type CategoryHeaderProps = {
  category: Category | null;
  totalCount: number;
  completedCount: number;
  completionRate: number;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onAddTodo?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  dragHandle?: ReactNode;
};

export function CategoryHeader({
  category,
  totalCount,
  completedCount,
  completionRate,
  collapsed,
  onToggleCollapse,
  onAddTodo,
  onEdit,
  onDelete,
  dragHandle,
}: CategoryHeaderProps) {
  const name = category?.name || "미분류";
  const color = category?.color || "#64748b";

  return (
    <div className="rounded-md border border-ink-700/60 bg-ink-900/55 p-2">
      <div className="flex min-w-0 items-center gap-2">
        {dragHandle}
        <button type="button" className="flex min-w-0 flex-1 items-center gap-2 rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/35" onClick={onToggleCollapse} aria-expanded={!collapsed}>
          <ChevronDown className={`shrink-0 text-ink-500 transition ${collapsed ? "-rotate-90" : ""}`} size={14} />
          <CategoryIcon icon={category?.icon} color={color} name={name} className={category?.icon ? "h-7 w-7" : "h-2.5 w-2.5"} />
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-2">
              <h3 className="truncate text-sm font-bold text-ink-100" title={name}>{name}</h3>
              <span className="shrink-0 text-[10px] font-semibold text-ink-500">{completedCount}/{totalCount}</span>
              <span className="hidden shrink-0 text-[10px] font-semibold text-accent-300 sm:inline">{formatCompletionRate(totalCount, completionRate)}</span>
            </div>
            {category?.description ? <p className="mt-0.5 truncate text-[10px] text-ink-600" title={category.description}>{category.description}</p> : null}
          </div>
        </button>

        <div className="flex shrink-0 items-center gap-1">
          {onAddTodo ? <button type="button" className="icon-btn h-8 w-8" onClick={onAddTodo} aria-label={`${name}에 Todo 추가`}><Plus size={13} /></button> : null}
          {category && onEdit ? <button type="button" className="icon-btn h-8 w-8" onClick={onEdit} aria-label={`${name} 수정`}><Pencil size={13} /></button> : null}
          {category && onDelete ? <button type="button" className="icon-btn h-8 w-8 hover:border-red-400 hover:text-red-200" onClick={onDelete} aria-label={`${name} 삭제`}><Trash2 size={13} /></button> : null}
        </div>
      </div>
      {!collapsed && totalCount > 0 ? <div className="mt-1.5"><ProgressBar value={completionRate} label="" empty={false} /></div> : null}
    </div>
  );
}
