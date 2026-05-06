import { ChevronDown, Pencil, Plus, Trash2 } from "lucide-react";
import type { Category } from "../../types/category";
import { ProgressBar } from "../common/ProgressBar";

type CategoryHeaderProps = {
  category: Category | null;
  totalCount: number;
  completedCount: number;
  completionRate: number;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onAddTodo: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
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
}: CategoryHeaderProps) {
  const name = category?.name || "미분류";
  const color = category?.color || "#64748b";

  return (
    <div className="rounded-lg border border-ink-700 bg-ink-900/70 p-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <button type="button" className="min-w-0 text-left" onClick={onToggleCollapse} aria-expanded={!collapsed}>
          <div className="flex min-w-0 items-center gap-2">
            <ChevronDown className={`shrink-0 text-ink-400 transition ${collapsed ? "-rotate-90" : ""}`} size={18} />
            <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: color }} aria-hidden="true" />
            <div className="min-w-0">
              <h3 className="truncate text-base font-bold text-ink-100">{name}</h3>
              {category?.description ? <p className="truncate text-xs text-ink-500">{category.description}</p> : null}
            </div>
            <span className="shrink-0 rounded-full border border-ink-700 bg-ink-950/70 px-2.5 py-1 text-xs font-semibold text-ink-300">
              {completedCount}/{totalCount} 완료
            </span>
            <span className="shrink-0 text-xs font-semibold text-accent-300">{completionRate}%</span>
          </div>
        </button>

        <div className="flex shrink-0 items-center gap-2">
          <button type="button" className="icon-btn min-h-9 min-w-9" onClick={onAddTodo} aria-label={`${name}에 Todo 추가`}>
            <Plus size={15} />
          </button>
          {category ? (
            <>
              <button type="button" className="icon-btn min-h-9 min-w-9" onClick={onEdit} aria-label={`${name} 수정`}>
                <Pencil size={15} />
              </button>
              <button type="button" className="icon-btn min-h-9 min-w-9 hover:border-red-400 hover:text-red-200" onClick={onDelete} aria-label={`${name} 삭제`}>
                <Trash2 size={15} />
              </button>
            </>
          ) : null}
        </div>
      </div>
      <div className="mt-3">
        <ProgressBar value={completionRate} label="" />
      </div>
    </div>
  );
}
