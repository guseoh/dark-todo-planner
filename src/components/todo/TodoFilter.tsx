import { RotateCcw, Search } from "lucide-react";
import { defaultFilters } from "../../hooks/useTodos";
import type { TodoFilters, TodoPriorityFilter, TodoStatusFilter } from "../../types/todo";

type TodoFilterProps = {
  filters: TodoFilters;
  onChange: (filters: TodoFilters) => void;
  tagOptions?: string[];
};

export function TodoFilter({ filters, onChange, tagOptions = [] }: TodoFilterProps) {
  const quickFilters: Array<{
    label: string;
    status: TodoStatusFilter;
    priority: TodoPriorityFilter;
  }> = [
    { label: "전체", status: "ALL", priority: "ALL" },
    { label: "미완료", status: "ACTIVE", priority: "ALL" },
    { label: "완료", status: "COMPLETED", priority: "ALL" },
    { label: "HIGH", status: "ALL", priority: "HIGH" },
    { label: "MEDIUM", status: "ALL", priority: "MEDIUM" },
    { label: "LOW", status: "ALL", priority: "LOW" },
  ];

  const isQuickActive = (status: TodoStatusFilter, priority: TodoPriorityFilter) =>
    filters.status === status && filters.priority === priority;

  return (
    <div className="app-card p-4">
      <div className="grid gap-3 xl:grid-cols-[minmax(0,1.15fr)_minmax(280px,1fr)_minmax(0,0.72fr)_minmax(0,0.72fr)_minmax(0,0.8fr)_auto]">
        <label className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-500" size={17} />
          <input
            className="field pl-10"
            value={filters.query}
            onChange={(event) => onChange({ ...filters, query: event.target.value })}
            placeholder="제목 또는 메모 검색"
            aria-label="검색"
          />
        </label>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6 xl:grid-cols-3" aria-label="빠른 필터">
          {quickFilters.map((filter) => (
            <button
              key={`${filter.status}-${filter.priority}`}
              type="button"
              onClick={() => onChange({ ...filters, status: filter.status, priority: filter.priority })}
              className={`min-h-10 rounded-lg border px-2 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/40 ${
                isQuickActive(filter.status, filter.priority)
                  ? "border-accent-500 bg-accent-500 text-white"
                  : "border-ink-700 bg-ink-950/55 text-ink-300 hover:border-accent-500/60 hover:text-ink-100"
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>
        <input
          className="field"
          type="date"
          value={filters.date}
          onChange={(event) => onChange({ ...filters, date: event.target.value })}
          aria-label="날짜 필터"
        />
        <select
          className="field"
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
          className="field"
          value={filters.sort}
          onChange={(event) => onChange({ ...filters, sort: event.target.value as TodoFilters["sort"] })}
          aria-label="정렬"
        >
          <option value="DATE_ASC">날짜 가까운순</option>
          <option value="NEWEST">최신순</option>
          <option value="OLDEST">오래된순</option>
          <option value="PRIORITY">우선순위 높은순</option>
        </select>
        <button type="button" className="btn-secondary px-3" onClick={() => onChange(defaultFilters)}>
          <RotateCcw size={17} />
          초기화
        </button>
      </div>
    </div>
  );
}
