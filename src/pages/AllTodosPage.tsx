import { useMemo, useState } from "react";
import { Activity, CalendarDays, Flag, FolderKanban, ListChecks, Settings2, Trash2, X } from "lucide-react";
import { defaultFilters } from "../hooks/useTodos";
import { todayKey } from "../lib/date";
import type { Category } from "../types/category";
import type { Project } from "../types/project";
import type { Todo, TodoBulkAction, TodoFilters, TodoInput, TodoPriority, TodoWorkflowStatus } from "../types/todo";
import { TodoFilter } from "../components/todo/TodoFilter";
import { GroupedTodoList } from "../components/todo/GroupedTodoList";

type AllTodosPageProps = {
  allTodos: Todo[];
  filterTodos: (filters: TodoFilters) => Todo[];
  tagOptions: string[];
  categories?: Category[];
  projects: Project[];
  duplicateTodoIds: ReadonlySet<string>;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onDeleteMany: (ids: string[]) => Promise<boolean>;
  onBulkUpdate: (ids: string[], action: TodoBulkAction) => Promise<boolean>;
  onUpdate: (id: string, updates: Partial<Omit<Todo, "id" | "createdAt">>) => void;
  onUnarchive: (id: string) => void;
  onAddTodo: (todo: TodoInput) => void;
  onAddCategory: (input: { name: string; description?: string; color?: string; icon?: string }) => void | Promise<void>;
  onUpdateCategory: (id: string, input: Partial<Category>) => void | Promise<void>;
  onDeleteCategory: (id: string, mode: "moveTodos" | "deleteTodos") => void | Promise<void>;
};

export function AllTodosPage({
  allTodos, filterTodos, tagOptions, categories = [], projects, duplicateTodoIds, onToggle, onDelete, onDeleteMany, onBulkUpdate,
  onUpdate, onUnarchive, onAddTodo, onAddCategory, onUpdateCategory, onDeleteCategory,
}: AllTodosPageProps) {
  const [filters, setFilters] = useState<TodoFilters>(defaultFilters);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [deleting, setDeleting] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [actionError, setActionError] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [projectValue, setProjectValue] = useState("");
  const [dateValue, setDateValue] = useState(todayKey());
  const [workflowValue, setWorkflowValue] = useState<TodoWorkflowStatus>("TODO");
  const [priorityValue, setPriorityValue] = useState<TodoPriority>("MEDIUM");
  const filteredTodos = useMemo(() => filterTodos(filters), [filterTodos, filters]);

  const toggleSelectionMode = () => {
    if (deleting || updating) return;
    const next = !selectionMode;
    setSelectionMode(next);
    if (!next) setSelectedIds(new Set());
    setActionError("");
    setActionMessage("");
  };

  const toggleSelected = (id: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setActionError("");
    setActionMessage("");
  };

  const selectTodos = (todos: Todo[]) => {
    setSelectedIds(new Set(todos.map((todo) => todo.id)));
    setActionError("");
    setActionMessage("");
  };

  const applyBulkAction = async (action: TodoBulkAction, label: string) => {
    const ids = [...selectedIds];
    if (!ids.length) return;
    setUpdating(true);
    setActionError("");
    setActionMessage("");
    const updated = await onBulkUpdate(ids, action);
    setUpdating(false);
    if (!updated) {
      setActionError("선택한 Todo를 변경하지 못했습니다. 잠시 후 다시 시도해주세요.");
      return;
    }
    setActionMessage(`${ids.length}개 Todo의 ${label} 변경을 반영했습니다.`);
  };

  const deleteIds = async (rawIds: string[], label: string) => {
    const ids = Array.from(new Set(rawIds.map((id) => id.trim()).filter(Boolean)));
    if (!ids.length) return;
    if (!window.confirm(`${label} ${ids.length}개를 휴지통으로 이동할까요? 휴지통에서 복원할 수 있습니다.`)) return;
    setDeleting(true);
    setActionError("");
    setActionMessage("");
    const deleted = await onDeleteMany(ids);
    setDeleting(false);
    if (!deleted) {
      setActionError("Todo를 휴지통으로 이동하지 못했습니다. 잠시 후 다시 시도해주세요.");
      return;
    }
    const removedIds = new Set(ids);
    setSelectedIds((current) => new Set([...current].filter((id) => !removedIds.has(id))));
    setActionMessage(`${ids.length}개 Todo를 휴지통으로 이동했습니다.`);
  };

  return (
    <div className="space-y-4">
      <section className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-ink-100">전체 Todo</h2>
          <p className="mt-1 text-sm text-ink-500">찾고, 고르고, 여러 Todo를 한 번에 정리하는 관리 화면입니다.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-ink-700/60 bg-ink-900/70 px-2.5 py-1 text-xs font-semibold text-ink-400">{filteredTodos.length}개 표시</span>
          <button
            type="button"
            className={`btn-secondary ${selectionMode ? "border-accent-500/45 bg-accent-500/10 text-accent-200" : ""}`}
            onClick={toggleSelectionMode}
            disabled={allTodos.length === 0 || deleting || updating}
          >
            {selectionMode ? <X size={15} /> : <ListChecks size={15} />}
            {selectionMode ? "선택 종료" : "선택 작업"}
          </button>
        </div>
      </section>

      <div className="sticky top-[60px] z-20 -mx-1 rounded-lg border border-ink-800/60 bg-ink-950/90 px-1 py-1.5 backdrop-blur-xl">
        <TodoFilter filters={filters} onChange={setFilters} tagOptions={tagOptions} categories={categories} />
      </div>

      {selectionMode ? (
        <section className="app-card p-3" aria-label="Todo 선택 작업 도구">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="relative pl-3">
              <span aria-hidden="true" className="absolute inset-y-0 left-0 w-0.5 rounded-full bg-accent-500" />
              <p className="text-sm font-bold text-ink-100">{selectedIds.size}개 선택됨</p>
              <p className="mt-0.5 text-[11px] text-ink-500">체크박스로 직접 고르거나 현재 검색 결과·전체 Todo를 한 번에 선택할 수 있습니다.</p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <button type="button" className="btn-secondary px-2.5 text-xs" onClick={() => selectTodos(filteredTodos)} disabled={!filteredTodos.length || deleting || updating}>현재 결과 {filteredTodos.length}개 선택</button>
              <button type="button" className="btn-secondary px-2.5 text-xs" onClick={() => selectTodos(allTodos)} disabled={!allTodos.length || deleting || updating}>전체 {allTodos.length}개 선택</button>
              <button type="button" className="btn-secondary px-2.5 text-xs" onClick={() => setSelectedIds(new Set())} disabled={!selectedIds.size || deleting || updating}>선택 해제</button>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-2 border-t border-ink-700/55 pt-3">
            <button type="button" className="btn-danger" onClick={() => void deleteIds([...selectedIds], "선택한 Todo")} disabled={!selectedIds.size || deleting || updating}>
              <Trash2 size={15} />{deleting ? "이동 중..." : `선택 ${selectedIds.size}개 삭제`}
            </button>
            <button type="button" className="btn-secondary hover:border-danger/60 hover:text-red-100" onClick={() => void deleteIds(filteredTodos.map((todo) => todo.id), "현재 결과 Todo")} disabled={!filteredTodos.length || deleting || updating}>
              <Trash2 size={15} />현재 결과 전체 삭제
            </button>
            <button type="button" className="btn-secondary hover:border-danger/60 hover:text-red-100" onClick={() => void deleteIds(allTodos.map((todo) => todo.id), "전체 Todo")} disabled={!allTodos.length || deleting || updating}>
              <Trash2 size={15} />전체 Todo 삭제
            </button>
          </div>

          <details className="mt-3 rounded-md border border-ink-700/55 bg-ink-950/25">
            <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 text-sm font-semibold text-ink-300 hover:bg-ink-800/45 hover:text-ink-100">
              <Settings2 size={15} className="text-accent-300" />선택 항목 일괄 변경
            </summary>
            <div className="grid gap-2 border-t border-ink-700/50 p-3 md:grid-cols-2 2xl:grid-cols-4">
              <label className="space-y-1 text-xs font-semibold text-ink-400">
                <span className="inline-flex items-center gap-1.5"><FolderKanban size={13} />프로젝트</span>
                <div className="flex gap-1.5"><select className="field" value={projectValue} onChange={(event) => setProjectValue(event.target.value)}><option value="">프로젝트 없음</option>{projects.filter((project) => !project.archived).map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select><button type="button" className="btn-secondary shrink-0 px-2.5" disabled={!selectedIds.size || updating || deleting} onClick={() => void applyBulkAction({ type: "PROJECT", value: projectValue || null }, "프로젝트")}>적용</button></div>
              </label>
              <label className="space-y-1 text-xs font-semibold text-ink-400">
                <span className="inline-flex items-center gap-1.5"><CalendarDays size={13} />실행일</span>
                <div className="flex gap-1.5"><input className="field" type="date" value={dateValue} onChange={(event) => setDateValue(event.target.value)} /><button type="button" className="btn-secondary shrink-0 px-2.5" disabled={!selectedIds.size || !dateValue || updating || deleting} onClick={() => void applyBulkAction({ type: "DATE", value: dateValue }, "실행일")}>적용</button></div>
              </label>
              <label className="space-y-1 text-xs font-semibold text-ink-400">
                <span className="inline-flex items-center gap-1.5"><Activity size={13} />작업 상태</span>
                <div className="flex gap-1.5"><select className="field" value={workflowValue} onChange={(event) => setWorkflowValue(event.target.value as TodoWorkflowStatus)}><option value="TODO">Todo</option><option value="IN_PROGRESS">진행 중</option><option value="BLOCKED">Blocked</option><option value="DONE">완료</option></select><button type="button" className="btn-secondary shrink-0 px-2.5" disabled={!selectedIds.size || updating || deleting} onClick={() => void applyBulkAction({ type: "WORKFLOW_STATUS", value: workflowValue }, "작업 상태")}>적용</button></div>
              </label>
              <label className="space-y-1 text-xs font-semibold text-ink-400">
                <span className="inline-flex items-center gap-1.5"><Flag size={13} />우선순위</span>
                <div className="flex gap-1.5"><select className="field" value={priorityValue} onChange={(event) => setPriorityValue(event.target.value as TodoPriority)}><option value="LOW">낮음</option><option value="MEDIUM">보통</option><option value="HIGH">높음</option></select><button type="button" className="btn-secondary shrink-0 px-2.5" disabled={!selectedIds.size || updating || deleting} onClick={() => void applyBulkAction({ type: "PRIORITY", value: priorityValue }, "우선순위")}>적용</button></div>
              </label>
            </div>
          </details>

          {actionMessage ? <p className="mt-3 rounded-md border border-success/30 bg-success/[0.08] px-3 py-2 text-xs font-semibold text-emerald-100" role="status">{actionMessage}</p> : null}
          {actionError ? <p className="mt-3 rounded-md border border-danger/40 bg-danger/[0.08] px-3 py-2 text-xs font-semibold text-red-100" role="alert">{actionError}</p> : null}
        </section>
      ) : null}

      <GroupedTodoList
        todos={filteredTodos}
        categories={categories}
        duplicateTodoIds={duplicateTodoIds}
        onAddTodo={onAddTodo}
        onToggle={onToggle}
        onDelete={onDelete}
        onUpdate={onUpdate}
        onUnarchive={onUnarchive}
        onAddCategory={onAddCategory}
        onUpdateCategory={onUpdateCategory}
        onDeleteCategory={onDeleteCategory}
        emptyTitle="조건에 맞는 Todo가 없습니다."
        emptyDescription="검색·필터를 바꾸거나 새로운 Todo를 추가해보세요."
        layout="list"
        showCategoryCreator={false}
        selectionMode={selectionMode}
        selectedIds={selectedIds}
        onSelectTodo={toggleSelected}
      />
    </div>
  );
}
