import { RotateCcw, Search } from "lucide-react";
import { defaultFilters } from "../../hooks/useTodos";
import type { TodoFilters } from "../../types/todo";

type TodoFilterProps = {
  filters: TodoFilters;
  onChange: (filters: TodoFilters) => void;
};

export function TodoFilter({ filters, onChange }: TodoFilterProps) {
  return (
    <div className="app-card p-4">
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1.4fr)_repeat(4,minmax(0,1fr))_auto]">
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
        <select
          className="field"
          value={filters.status}
          onChange={(event) => onChange({ ...filters, status: event.target.value as TodoFilters["status"] })}
          aria-label="완료 여부 필터"
        >
          <option value="ALL">전체</option>
          <option value="ACTIVE">미완료</option>
          <option value="COMPLETED">완료</option>
        </select>
        <select
          className="field"
          value={filters.priority}
          onChange={(event) => onChange({ ...filters, priority: event.target.value as TodoFilters["priority"] })}
          aria-label="우선순위 필터"
        >
          <option value="ALL">모든 우선순위</option>
          <option value="HIGH">높음</option>
          <option value="MEDIUM">보통</option>
          <option value="LOW">낮음</option>
        </select>
        <input
          className="field"
          type="date"
          value={filters.date}
          onChange={(event) => onChange({ ...filters, date: event.target.value })}
          aria-label="날짜 필터"
        />
        <select
          className="field"
          value={filters.sort}
          onChange={(event) => onChange({ ...filters, sort: event.target.value as TodoFilters["sort"] })}
          aria-label="정렬"
        >
          <option value="NEWEST">최신순</option>
          <option value="OLDEST">오래된순</option>
          <option value="PRIORITY">우선순위 높은순</option>
          <option value="DATE_ASC">날짜 가까운순</option>
        </select>
        <button type="button" className="btn-secondary px-3" onClick={() => onChange(defaultFilters)}>
          <RotateCcw size={17} />
          초기화
        </button>
      </div>
    </div>
  );
}
