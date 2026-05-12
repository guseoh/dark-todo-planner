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
      <div className="flex min-w-0 flex-col gap-2">
        <div className="flex min-w-0 items-start justify-between gap-2">
          <div className="flex min-w-0 flex-1 items-start gap-2">
          {dragHandle}
          <button type="button" className="min-w-0 flex-1 text-left" onClick={onToggleCollapse} aria-expanded={!collapsed}>
            <div className="flex min-w-0 items-start gap-2">
              <ChevronDown className={`mt-1 shrink-0 text-ink-400 transition ${collapsed ? "-rotate-90" : ""}`} size={16} />
              <CategoryIcon icon={category?.icon} color={color} name={name} className={category?.icon ? "h-8 w-8" : "mt-2 h-2.5 w-2.5"} />
              <div className="min-w-0 flex-1">
                <h3 className="line-clamp-2 break-words text-sm font-extrabold leading-5 text-ink-100 sm:text-base" title={name}>
                  {name}
                </h3>
                {category?.description ? (
                  <p className="mt-0.5 truncate text-xs text-ink-500" title={category.description}>
                    {category.description}
                  </p>
                ) : null}
              </div>
            </div>
          </button>
          </div>

          <div className="flex shrink-0 items-center gap-1">
            <span className="hidden whitespace-nowrap rounded-full border border-ink-700 bg-ink-950/70 px-2 py-0.5 text-[11px] font-semibold text-ink-300 sm:inline-flex">
              {completedCount}/{totalCount}
            </span>
            <span className="hidden whitespace-nowrap text-[11px] font-semibold text-accent-300 sm:inline-flex">{completionRate}%</span>
          <button type="button" className="icon-btn min-h-7 min-w-7 rounded-md" onClick={onAddTodo} aria-label={`${name}에 Todo 추가`}>
            <Plus size={15} />
          </button>
          {category ? (
            <>
              <button type="button" className="icon-btn min-h-7 min-w-7 rounded-md" onClick={onEdit} aria-label={`${name} 수정`}>
                <Pencil size={15} />
              </button>
              <button type="button" className="icon-btn min-h-7 min-w-7 rounded-md hover:border-red-400 hover:text-red-200" onClick={onDelete} aria-label={`${name} 삭제`}>
                <Trash2 size={15} />
              </button>
            </>
          ) : null}
          </div>
        </div>
        <div className="flex items-center justify-between gap-2 sm:hidden">
          <span className="whitespace-nowrap rounded-full border border-ink-700 bg-ink-950/70 px-2 py-0.5 text-[11px] font-semibold text-ink-300">
            {completedCount}/{totalCount} 완료
          </span>
          <span className="text-[11px] font-semibold text-accent-300">{completionRate}%</span>
        </div>
      </div>
      <div className="mt-2">
        <ProgressBar value={completionRate} label="" />
      </div>
    </div>
  );
}
