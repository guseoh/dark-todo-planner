import { useMemo, useState } from "react";
import { Activity, CalendarDays, Flag, FolderKanban, ListChecks, Trash2 } from "lucide-react";
import { defaultFilters } from "../hooks/useTodos";
import { todayKey } from "../lib/date";
import type { Category } from "../types/category";
import type { Project } from "../types/project";
import type { Todo, TodoBulkAction, TodoFilters, TodoInput, TodoPriority, TodoWorkflowStatus } from "../types/todo";
import { Modal } from "../components/common/Modal";
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
  const [showSelectionManager, setShowSelectionManager] = useState(false);
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

  const openSelectionManager = () => {
    setSelectedIds(new Set()); setActionError(""); setActionMessage(""); setShowSelectionManager(true);
  };

  const closeSelectionManager = () => {
    if (deleting || updating) return;
    setShowSelectionManager(false); setSelectedIds(new Set()); setActionError(""); setActionMessage("");
  };

  const toggleSelected = (id: string) => {
    setSelectedIds((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  };

  const selectTodos = (todos: Todo[]) => { setSelectedIds(new Set(todos.map((todo) => todo.id))); setActionError(""); setActionMessage(""); };

  const applyBulkAction = async (action: TodoBulkAction, label: string) => {
    const ids = [...selectedIds];
    if (!ids.length) return;
    setUpdating(true); setActionError(""); setActionMessage("");
    const updated = await onBulkUpdate(ids, action);
    setUpdating(false);
    if (!updated) { setActionError("선택한 Todo를 변경하지 못했습니다. 잠시 후 다시 시도해주세요."); return; }
    setActionMessage(`${ids.length}개 Todo의 ${label} 변경을 반영했습니다.`);
  };

  const deleteSelected = async () => {
    const ids = [...selectedIds];
    if (!ids.length) return;
    const deletingAll = ids.length === allTodos.length && allTodos.length > 0;
    const message = deletingAll ? `저장된 모든 Todo ${ids.length}개를 휴지통으로 이동할까요? 휴지통에서 복원할 수 있습니다.` : `선택한 Todo ${ids.length}개를 휴지통으로 이동할까요? 휴지통에서 복원할 수 있습니다.`;
    if (!window.confirm(message)) return;
    setDeleting(true); setActionError(""); setActionMessage("");
    const deleted = await onDeleteMany(ids);
    setDeleting(false);
    if (!deleted) { setActionError("선택한 Todo를 휴지통으로 이동하지 못했습니다. 잠시 후 다시 시도해주세요."); return; }
    setShowSelectionManager(false); setSelectedIds(new Set());
  };

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div><h2 className="text-2xl font-bold text-ink-100 sm:text-3xl">전체 Todo</h2><p className="mt-2 text-sm text-ink-400">검색·필터·정렬과 선택 작업으로 여러 Todo를 한 번에 관리합니다.</p></div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-ink-850 px-3 py-1 text-sm text-ink-300">{filteredTodos.length}개 표시</span>
          <button type="button" className="btn-secondary min-h-9 px-3 py-1 text-sm" onClick={openSelectionManager} disabled={allTodos.length === 0}><ListChecks size={15} />선택 작업</button>
        </div>
      </section>

      <div className="sticky top-[76px] z-20 -mx-1 rounded-xl bg-ink-950/90 px-1 py-2 backdrop-blur-xl">
        <TodoFilter filters={filters} onChange={setFilters} tagOptions={tagOptions} categories={categories} />
      </div>

      <GroupedTodoList
        todos={filteredTodos} categories={categories} duplicateTodoIds={duplicateTodoIds} onAddTodo={onAddTodo} onToggle={onToggle} onDelete={onDelete} onUpdate={onUpdate} onUnarchive={onUnarchive}
        onAddCategory={onAddCategory} onUpdateCategory={onUpdateCategory} onDeleteCategory={onDeleteCategory}
        emptyTitle="아직 등록된 Todo가 없습니다." emptyDescription="검색 조건을 바꾸거나 새로운 Todo를 추가해보세요." includeEmptyCategories
      />

      {showSelectionManager ? (
        <Modal title="Todo 선택 작업" description="여러 Todo를 선택한 뒤 프로젝트·실행일·작업 상태·우선순위를 일괄 변경하거나 휴지통으로 이동합니다." onClose={closeSelectionManager} size="lg">
          <div className="space-y-4">
            <div className="flex flex-col gap-3 rounded-lg bg-ink-950/45 p-3 sm:flex-row sm:items-center sm:justify-between">
              <div><p className="text-sm font-bold text-ink-100">{selectedIds.size}개 선택됨</p><p className="mt-1 text-xs text-ink-400">보관된 Todo도 ‘모든 Todo 선택’에 포함됩니다.</p></div>
              <div className="flex flex-wrap gap-2">
                <button type="button" className="btn-secondary min-h-9 px-3 py-1 text-xs" onClick={() => selectTodos(filteredTodos)} disabled={!filteredTodos.length || deleting || updating}>현재 결과 {filteredTodos.length}개 선택</button>
                <button type="button" className="btn-secondary min-h-9 px-3 py-1 text-xs" onClick={() => selectTodos(allTodos)} disabled={!allTodos.length || deleting || updating}>모든 Todo {allTodos.length}개 선택</button>
                <button type="button" className="btn-secondary min-h-9 px-3 py-1 text-xs" onClick={() => setSelectedIds(new Set())} disabled={!selectedIds.size || deleting || updating}>선택 해제</button>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-xl border border-ink-700/70 bg-ink-950/35 p-3">
                <div className="mb-2 flex items-center gap-2 text-sm font-bold text-ink-200"><FolderKanban size={15} className="text-accent-300" />프로젝트 변경</div>
                <div className="flex gap-2"><select className="field min-h-10" value={projectValue} onChange={(event) => setProjectValue(event.target.value)}><option value="">프로젝트 없음</option>{projects.filter((project) => !project.archived).map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select><button type="button" className="btn-secondary shrink-0" disabled={!selectedIds.size || updating || deleting} onClick={() => void applyBulkAction({ type: "PROJECT", value: projectValue || null }, "프로젝트")}>적용</button></div>
                <p className="mt-2 text-[11px] text-ink-500">프로젝트를 바꾸면 기존 마일스톤·상위 Todo 연결은 안전하게 해제됩니다.</p>
              </div>

              <div className="rounded-xl border border-ink-700/70 bg-ink-950/35 p-3">
                <div className="mb-2 flex items-center gap-2 text-sm font-bold text-ink-200"><CalendarDays size={15} className="text-accent-300" />실행일 변경</div>
                <div className="flex gap-2"><input className="field min-h-10" type="date" value={dateValue} onChange={(event) => setDateValue(event.target.value)} /><button type="button" className="btn-secondary shrink-0" disabled={!selectedIds.size || !dateValue || updating || deleting} onClick={() => void applyBulkAction({ type: "DATE", value: dateValue }, "실행일")}>적용</button></div>
                <p className="mt-2 text-[11px] text-ink-500">실행일을 지정하면 Inbox/Someday/Waiting 항목도 일정 상태로 이동합니다.</p>
              </div>

              <div className="rounded-xl border border-ink-700/70 bg-ink-950/35 p-3">
                <div className="mb-2 flex items-center gap-2 text-sm font-bold text-ink-200"><Activity size={15} className="text-accent-300" />작업 상태 변경</div>
                <div className="flex gap-2"><select className="field min-h-10" value={workflowValue} onChange={(event) => setWorkflowValue(event.target.value as TodoWorkflowStatus)}><option value="TODO">Todo</option><option value="IN_PROGRESS">진행 중</option><option value="BLOCKED">Blocked</option><option value="DONE">완료</option></select><button type="button" className="btn-secondary shrink-0" disabled={!selectedIds.size || updating || deleting} onClick={() => void applyBulkAction({ type: "WORKFLOW_STATUS", value: workflowValue }, "작업 상태")}>적용</button></div>
              </div>

              <div className="rounded-xl border border-ink-700/70 bg-ink-950/35 p-3">
                <div className="mb-2 flex items-center gap-2 text-sm font-bold text-ink-200"><Flag size={15} className="text-accent-300" />우선순위 변경</div>
                <div className="flex gap-2"><select className="field min-h-10" value={priorityValue} onChange={(event) => setPriorityValue(event.target.value as TodoPriority)}><option value="LOW">낮음</option><option value="MEDIUM">보통</option><option value="HIGH">높음</option></select><button type="button" className="btn-secondary shrink-0" disabled={!selectedIds.size || updating || deleting} onClick={() => void applyBulkAction({ type: "PRIORITY", value: priorityValue }, "우선순위")}>적용</button></div>
              </div>
            </div>

            {actionMessage ? <p className="rounded-lg border border-success/35 bg-success/10 px-3 py-2 text-sm text-ink-200" role="status">{actionMessage}</p> : null}
            {actionError ? <p className="rounded-lg border border-danger/45 bg-danger/10 px-3 py-2 text-sm text-red-100" role="alert">{actionError}</p> : null}

            <div className="max-h-[42vh] space-y-2 overflow-y-auto pr-1" aria-label="작업할 Todo 선택 목록">
              {allTodos.map((todo) => {
                const checked = selectedIds.has(todo.id);
                return (
                  <label key={todo.id} className={`flex cursor-pointer items-start gap-3 rounded-lg px-3 py-2.5 transition ${checked ? "bg-accent-500/10 ring-1 ring-accent-500/40" : "bg-ink-950/35 hover:bg-ink-800/80"}`}>
                    <input type="checkbox" className="mt-1 h-4 w-4 shrink-0 accent-accent-500" checked={checked} onChange={() => toggleSelected(todo.id)} disabled={deleting || updating} />
                    <span className="min-w-0 flex-1"><span className={`block break-words text-sm font-semibold ${todo.completed ? "text-ink-400 line-through" : "text-ink-100"}`}>{todo.title}</span><span className="mt-1 flex flex-wrap gap-x-2 gap-y-1 text-xs text-ink-400"><span>{todo.date}</span><span>{todo.category?.name || "미분류"}</span>{todo.completed ? <span>완료</span> : <span>미완료</span>}{todo.archived ? <span className="text-amber-200">보관됨</span> : null}</span></span>
                  </label>
                );
              })}
            </div>

            <div className="flex flex-col-reverse gap-2 border-t border-ink-700/60 pt-4 sm:flex-row sm:justify-between">
              <button type="button" className="btn-danger" onClick={deleteSelected} disabled={!selectedIds.size || deleting || updating}><Trash2 size={16} />{deleting ? "이동 중..." : `선택 ${selectedIds.size}개 휴지통 이동`}</button>
              <button type="button" className="btn-secondary" onClick={closeSelectionManager} disabled={deleting || updating}>닫기</button>
            </div>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
