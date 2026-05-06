import { RotateCcw } from "lucide-react";
import { useState } from "react";
import { defaultFilters } from "../../hooks/useTodos";
import type { Category } from "../../types/category";
import type { TodoFilters, TodoPriorityFilter, TodoStatusFilter } from "../../types/todo";
import { TodoSearchInput } from "./TodoSearchInput";

type TodoFilterBarProps = {
  filters: TodoFilters;
  onChange: (filters: TodoFilters) => void;
  tagOptions?: string[];
  categories?: Category[];
};

const filterButtonClassName =
  "inline-flex h-9 items-center justify-center whitespace-nowrap rounded-lg border px-3 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/40";

export function TodoFilterBar({ filters, onChange, tagOptions = [], categories = [] }: TodoFilterBarProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const statusFilters: Array<{ label: string; value: TodoStatusFilter }> = [
    { label: "전체", value: "ALL" },
    { label: "미완료", value: "ACTIVE" },
    { label: "완료", value: "COMPLETED" },
  ];

  const priorityFilters: Array<{ label: string; value: TodoPriorityFilter }> = [
    { label: "우선순위 전체", value: "ALL" },
    { label: "HIGH", value: "HIGH" },
    { label: "MEDIUM", value: "MEDIUM" },
    { label: "LOW", value: "LOW" },
  ];

  const buttonTone = (active: boolean) =>
    active
      ? "border-accent-500 bg-accent-500 text-white"
      : "border-ink-700 bg-ink-950/55 text-ink-300 hover:border-accent-500/60 hover:text-ink-100";

  return (
    <div className="app-card p-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
        <div className="min-w-0 flex-1">
          <TodoSearchInput value={filters.query} onChange={(query) => onChange({ ...filters, query })} />
        </div>

        <div className="flex flex-wrap gap-2" aria-label="완료 상태 필터">
          {statusFilters.map((filter) => (
            <button
              key={filter.value}
              type="button"
              onClick={() => onChange({ ...filters, status: filter.value })}
              className={`${filterButtonClassName} ${buttonTone(filters.status === filter.value)}`}
            >
              {filter.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-2" aria-label="우선순위 필터">
          {priorityFilters.map((filter) => (
            <button
              key={filter.value}
              type="button"
              onClick={() => onChange({ ...filters, priority: filter.value })}
              className={`${filterButtonClassName} ${buttonTone(filters.priority === filter.value)}`}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" className="btn-secondary min-h-10 px-3 py-1.5" onClick={() => setShowAdvanced((value) => !value)} aria-expanded={showAdvanced}>
          {showAdvanced ? "고급 필터 닫기" : "고급 필터"}
        </button>
        <button type="button" className="btn-secondary min-h-10 px-3 py-1.5" onClick={() => onChange(defaultFilters)}>
          <RotateCcw size={16} />
          초기화
        </button>
      </div>

      {showAdvanced ? (
        <div className="mt-3 flex flex-wrap gap-2 border-t border-ink-700/70 pt-3">
          <input
            className="field h-10 min-h-10 w-full py-1.5 sm:w-40"
            type="date"
            value={filters.date}
            onChange={(event) => onChange({ ...filters, date: event.target.value })}
            aria-label="날짜 필터"
          />
          <select
            className="field h-10 min-h-10 w-full py-1.5 sm:w-44"
            value={filters.categoryId}
            onChange={(event) => onChange({ ...filters, categoryId: event.target.value })}
            aria-label="카테고리 필터"
          >
            <option value="">모든 카테고리</option>
            <option value="uncategorized">미분류</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
          <select
            className="field h-10 min-h-10 w-full py-1.5 sm:w-40"
            value={filters.tag}
            onChange={(event) => onChange({ ...filters, tag: event.target.value })}
            aria-label="태그 필터"
          >
            <option value="">모든 태그</option>
            {tagOptions.map((tag) => (
              <option key={tag} value={tag}>
                #{tag}
              </option>
            ))}
          </select>
          <select
            className="field h-10 min-h-10 w-full py-1.5 sm:w-40"
            value={filters.repeat}
            onChange={(event) => onChange({ ...filters, repeat: event.target.value as TodoFilters["repeat"] })}
            aria-label="반복 필터"
          >
            <option value="ALL">모든 반복</option>
            <option value="NONE">반복 없음</option>
            <option value="DAILY">매일</option>
            <option value="WEEKLY">매주</option>
            <option value="MONTHLY">매월</option>
            <option value="WEEKDAY">평일</option>
            <option value="WEEKEND">주말</option>
          </select>
          <select
            className="field h-10 min-h-10 w-full py-1.5 sm:w-40"
            value={filters.archived}
            onChange={(event) => onChange({ ...filters, archived: event.target.value as TodoFilters["archived"] })}
            aria-label="보관 필터"
          >
            <option value="ACTIVE">보관 제외</option>
            <option value="ARCHIVED">보관함</option>
            <option value="ALL">전체</option>
          </select>
          <select
            className="field h-10 min-h-10 w-full py-1.5 sm:w-44"
            value={filters.sort}
            onChange={(event) => onChange({ ...filters, sort: event.target.value as TodoFilters["sort"] })}
            aria-label="정렬"
          >
            <option value="DATE_ASC">날짜 가까운순</option>
            <option value="NEWEST">최신순</option>
            <option value="OLDEST">오래된순</option>
            <option value="PRIORITY">우선순위 높은순</option>
          </select>
        </div>
      ) : null}
    </div>
  );
}
