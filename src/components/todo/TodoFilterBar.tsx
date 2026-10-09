import { BookmarkPlus, RotateCcw, Trash2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { defaultFilters } from "../../hooks/useTodos";
import type { Category } from "../../types/category";
import type { Project } from "../../types/project";
import type { TodoFilters, TodoPriorityFilter, TodoStatusFilter, TodoWorkflowStatus } from "../../types/todo";
import { workflowStatusLabels } from "../../lib/todoLabels";
import { TodoSearchInput } from "./TodoSearchInput";

type TodoFilterBarProps = {
  filters: TodoFilters;
  onChange: (filters: TodoFilters) => void;
  categories?: Category[];
  projects?: Project[];
};

type SavedTodoView = { id: string; name: string; filters: TodoFilters };
const SAVED_VIEWS_KEY = "dark-todo-planner:saved-todo-views";
const MAX_SAVED_VIEWS = 12;

function readSavedViews(): SavedTodoView[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(SAVED_VIEWS_KEY) || "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((item): SavedTodoView[] => {
      if (typeof item?.id !== "string" || typeof item?.name !== "string" || !item?.filters || typeof item.filters !== "object") return [];
      const filters = item.filters as Partial<TodoFilters>;
      if (typeof filters.query !== "string" || typeof filters.projectId !== "string" || typeof filters.workflowStatus !== "string") return [];
      return [{ id: item.id, name: item.name.slice(0, 48), filters: { ...defaultFilters, ...filters } }];
    }).slice(0, MAX_SAVED_VIEWS);
  } catch {
    return [];
  }
}

const filterButtonClassName =
  "inline-flex h-8 items-center justify-center whitespace-nowrap rounded-md border px-2.5 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/35";

export function TodoFilterBar({ filters, onChange, categories = [], projects = [] }: TodoFilterBarProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [savedViews, setSavedViews] = useState<SavedTodoView[]>(readSavedViews);
  const [viewName, setViewName] = useState("");
  const [selectedViewId, setSelectedViewId] = useState("");
  const changeFilters = (next: TodoFilters) => {
    setSelectedViewId("");
    onChange(next);
  };

  const saveView = (event: FormEvent) => {
    event.preventDefault();
    const name = viewName.trim().slice(0, 48);
    if (!name) return;
    const existing = savedViews.find((view) => view.name.toLocaleLowerCase() === name.toLocaleLowerCase());
    if (!existing && savedViews.length >= MAX_SAVED_VIEWS) return;
    const next = existing
      ? savedViews.map((view) => view.id === existing.id ? { ...view, filters: { ...filters }, name } : view)
      : [...savedViews, { id: typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `view-${Date.now()}`, name, filters: { ...filters } }];
    setSavedViews(next);
    try { localStorage.setItem(SAVED_VIEWS_KEY, JSON.stringify(next)); } catch { /* Keep saved views usable for the current session. */ }
    setSelectedViewId(existing?.id || next[next.length - 1].id);
    setViewName("");
  };

  const deleteSelectedView = () => {
    const next = savedViews.filter((view) => view.id !== selectedViewId);
    setSavedViews(next);
    try { localStorage.setItem(SAVED_VIEWS_KEY, JSON.stringify(next)); } catch { /* Keep saved views usable for the current session. */ }
    setSelectedViewId("");
  };
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
      : "border-ink-700/70 bg-ink-950/50 text-ink-400 hover:border-accent-500/55 hover:text-ink-100";

  return (
    <div className="app-card p-3">
      <div className="flex flex-col gap-2 xl:flex-row xl:items-center">
        <div className="min-w-0 flex-1">
          <TodoSearchInput value={filters.query} onChange={(query) => changeFilters({ ...filters, query })} />
        </div>

        <div className="flex flex-wrap gap-1.5" aria-label="완료 상태 필터">
          {statusFilters.map((filter) => (
            <button key={filter.value} type="button" onClick={() => changeFilters({ ...filters, status: filter.value })} className={`${filterButtonClassName} ${buttonTone(filters.status === filter.value)}`}>
              {filter.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-1.5" aria-label="우선순위 필터">
          {priorityFilters.map((filter) => (
            <button key={filter.value} type="button" onClick={() => changeFilters({ ...filters, priority: filter.value })} className={`${filterButtonClassName} ${buttonTone(filters.priority === filter.value)}`}>
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5">
        <button type="button" className={`${filterButtonClassName} ${buttonTone(filters.duplicatesOnly)}`} onClick={() => changeFilters({ ...filters, duplicatesOnly: !filters.duplicatesOnly })} aria-pressed={filters.duplicatesOnly}>
          중복 후보만
        </button>
        <button type="button" className="btn-secondary min-h-8 px-2.5 py-1 text-xs" onClick={() => setShowAdvanced((value) => !value)} aria-expanded={showAdvanced}>
          {showAdvanced ? "고급 필터 닫기" : "고급 필터"}
        </button>
        <button type="button" className="btn-secondary min-h-8 px-2.5 py-1 text-xs" onClick={() => changeFilters(defaultFilters)}>
          <RotateCcw size={14} />초기화
        </button>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5 border-t border-ink-700/55 pt-2" aria-label="저장된 보기">
        <>
            <select className="field h-9 min-h-9 w-full py-1 sm:w-52" aria-label="저장된 보기" value={selectedViewId} onChange={(event) => {
              const view = savedViews.find((item) => item.id === event.target.value);
              if (view) { onChange(view.filters); setSelectedViewId(view.id); }
            }}>
              <option value="">{savedViews.length ? "저장된 보기 불러오기" : "저장된 보기 없음"}</option>
              {savedViews.map((view) => <option key={view.id} value={view.id}>{view.name}</option>)}
            </select>
            <button type="button" className="icon-btn h-9 w-9" onClick={deleteSelectedView} disabled={!selectedViewId} aria-label="선택한 보기 삭제" title="선택한 보기 삭제"><Trash2 size={14} /></button>
        </>
        <form onSubmit={saveView} className="flex min-w-0 flex-1 gap-1.5 sm:ml-auto sm:max-w-sm">
          <input className="field h-9 min-h-9 min-w-0 py-1" value={viewName} onChange={(event) => setViewName(event.target.value)} placeholder="현재 조건을 저장할 이름" aria-label="저장된 보기 이름" maxLength={48} />
          <button type="submit" className="btn-secondary min-h-9 shrink-0 px-2.5 py-1 text-xs" disabled={!viewName.trim() || (savedViews.length >= MAX_SAVED_VIEWS && !savedViews.some((view) => view.name.toLocaleLowerCase() === viewName.trim().toLocaleLowerCase()))}>
            <BookmarkPlus size={14} />저장
          </button>
        </form>
      </div>

      {showAdvanced ? (
        <div className="mt-2 flex flex-wrap gap-1.5 border-t border-ink-700/55 pt-2">
          <input className="field h-9 min-h-9 w-full py-1 sm:w-40" type="date" value={filters.date} onChange={(event) => changeFilters({ ...filters, date: event.target.value })} aria-label="날짜 필터" />
          <select className="field h-9 min-h-9 w-full py-1 sm:w-44" value={filters.categoryId} onChange={(event) => changeFilters({ ...filters, categoryId: event.target.value })} aria-label="카테고리 필터">
            <option value="">모든 카테고리</option><option value="uncategorized">미분류</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
          </select>
          <select className="field h-9 min-h-9 w-full py-1 sm:w-48" value={filters.projectId} onChange={(event) => changeFilters({ ...filters, projectId: event.target.value })} aria-label="프로젝트 필터">
            <option value="">모든 프로젝트</option><option value="unassigned">프로젝트 미지정</option>{projects.filter((project) => !project.archived || project.id === filters.projectId).map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
          </select>
          <select className="field h-9 min-h-9 w-full py-1 sm:w-44" value={filters.workflowStatus} onChange={(event) => changeFilters({ ...filters, workflowStatus: event.target.value as "ALL" | TodoWorkflowStatus })} aria-label="작업 상태 필터">
            <option value="ALL">모든 작업 상태</option>{(["TODO", "IN_PROGRESS", "BLOCKED", "DONE"] as const).map((status) => <option key={status} value={status}>{workflowStatusLabels[status]}</option>)}
          </select>
          <select className="field h-9 min-h-9 w-full py-1 sm:w-40" value={filters.archived} onChange={(event) => changeFilters({ ...filters, archived: event.target.value as TodoFilters["archived"] })} aria-label="보관 필터">
            <option value="ACTIVE">보관 제외</option><option value="ARCHIVED">보관됨</option><option value="ALL">전체</option>
          </select>
          <select className="field h-9 min-h-9 w-full py-1 sm:w-44" value={filters.sort} onChange={(event) => changeFilters({ ...filters, sort: event.target.value as TodoFilters["sort"] })} aria-label="정렬">
            <option value="DATE_ASC">날짜 가까운순</option><option value="NEWEST">최신순</option><option value="OLDEST">오래된순</option><option value="PRIORITY">우선순위 높은순</option>
          </select>
        </div>
      ) : null}
    </div>
  );
}
