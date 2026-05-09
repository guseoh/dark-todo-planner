import { ChevronDown, Pencil, Plus, Trash2 } from "lucide-react";
import type { ReactNode } from "react";
import type { Category } from "../../types/category";
import { ProgressBar } from "../common/ProgressBar";
import { CategoryIcon } from "./CategoryIcon";

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
    <div className="rounded-lg border border-ink-700 bg-ink-900/70 p-2.5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-2">
          {dragHandle}
          <button type="button" className="min-w-0 text-left" onClick={onToggleCollapse} aria-expanded={!collapsed}>
            <div className="flex min-w-0 items-center gap-2">
              <ChevronDown className={`shrink-0 text-ink-400 transition ${collapsed ? "-rotate-90" : ""}`} size={16} />
              <CategoryIcon icon={category?.icon} color={color} name={name} className={category?.icon ? "h-7 w-7" : "h-2.5 w-2.5"} />
              <div className="min-w-0">
                <h3 className="truncate text-sm font-bold text-ink-100 sm:text-base">{name}</h3>
                {category?.description ? <p className="truncate text-xs text-ink-500">{category.description}</p> : null}
              </div>
              <span className="shrink-0 whitespace-nowrap rounded-full border border-ink-700 bg-ink-950/70 px-2 py-0.5 text-[11px] font-semibold text-ink-300">
                {completedCount}/{totalCount} 완료
              </span>
              <span className="shrink-0 text-[11px] font-semibold text-accent-300">{completionRate}%</span>
            </div>
          </button>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button type="button" className="icon-btn min-h-8 min-w-8 rounded-md" onClick={onAddTodo} aria-label={`${name}에 Todo 추가`}>
            <Plus size={15} />
          </button>
          {category ? (
            <>
              <button type="button" className="icon-btn min-h-8 min-w-8 rounded-md" onClick={onEdit} aria-label={`${name} 수정`}>
                <Pencil size={15} />
              </button>
              <button type="button" className="icon-btn min-h-8 min-w-8 rounded-md hover:border-red-400 hover:text-red-200" onClick={onDelete} aria-label={`${name} 삭제`}>
                <Trash2 size={15} />
              </button>
            </>
          ) : null}
        </div>
      </div>
      <div className="mt-2">
        <ProgressBar value={completionRate} label="" />
      </div>
    </div>
  );
}
