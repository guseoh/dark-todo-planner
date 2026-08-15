import { useMemo, useState } from "react";
import { ListChecks, Trash2 } from "lucide-react";
import { defaultFilters } from "../hooks/useTodos";
import type { Category } from "../types/category";
import type { Todo, TodoFilters, TodoInput } from "../types/todo";
import { Modal } from "../components/common/Modal";
import { TodoFilter } from "../components/todo/TodoFilter";
import { GroupedTodoList } from "../components/todo/GroupedTodoList";

type AllTodosPageProps = {
  allTodos: Todo[];
  filterTodos: (filters: TodoFilters) => Todo[];
  tagOptions: string[];
  categories?: Category[];
  duplicateTodoIds: ReadonlySet<string>;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onDeleteMany: (ids: string[]) => Promise<boolean>;
  onUpdate: (id: string, updates: Partial<Omit<Todo, "id" | "createdAt">>) => void;
  onUnarchive: (id: string) => void;
  onAddTodo: (todo: TodoInput) => void;
  onAddCategory: (input: { name: string; description?: string; color?: string; icon?: string }) => void | Promise<void>;
  onUpdateCategory: (id: string, input: Partial<Category>) => void | Promise<void>;
  onDeleteCategory: (id: string, mode: "moveTodos" | "deleteTodos") => void | Promise<void>;
};

export function AllTodosPage({
  allTodos,
  filterTodos,
  tagOptions,
  categories = [],
  duplicateTodoIds,
  onToggle,
  onDelete,
  onDeleteMany,
  onUpdate,
  onUnarchive,
  onAddTodo,
  onAddCategory,
  onUpdateCategory,
  onDeleteCategory,
}: AllTodosPageProps) {
  const [filters, setFilters] = useState<TodoFilters>(defaultFilters);
  const [showDeleteManager, setShowDeleteManager] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const filteredTodos = useMemo(() => filterTodos(filters), [filterTodos, filters]);

  const openDeleteManager = () => {
    setSelectedIds(new Set());
    setDeleteError("");
    setShowDeleteManager(true);
  };

  const closeDeleteManager = () => {
    if (deleting) return;
    setShowDeleteManager(false);
    setSelectedIds(new Set());
    setDeleteError("");
  };

  const toggleSelected = (id: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectTodos = (todos: Todo[]) => {
    setSelectedIds(new Set(todos.map((todo) => todo.id)));
    setDeleteError("");
  };

  const deleteSelected = async () => {
    const ids = [...selectedIds];
    if (!ids.length) return;
    const deletingAll = ids.length === allTodos.length && allTodos.length > 0;
    const message = deletingAll
      ? `저장된 모든 Todo ${ids.length}개를 영구 삭제할까요? 이 작업은 되돌릴 수 없습니다.`
      : `선택한 Todo ${ids.length}개를 영구 삭제할까요? 이 작업은 되돌릴 수 없습니다.`;
    if (!window.confirm(message)) return;

    setDeleting(true);
    setDeleteError("");
    const deleted = await onDeleteMany(ids);
    setDeleting(false);
    if (!deleted) {
      setDeleteError("선택한 Todo를 삭제하지 못했습니다. 잠시 후 다시 시도해주세요.");
      return;
    }
    setShowDeleteManager(false);
    setSelectedIds(new Set());
  };

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-ink-100 sm:text-3xl">전체 Todo</h2>
          <p className="mt-2 text-sm text-ink-400">검색, 필터, 정렬로 모든 Todo를 빠르게 찾습니다.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-ink-850 px-3 py-1 text-sm text-ink-300">
            {filteredTodos.length}개 표시
          </span>
          <button
            type="button"
            className="btn-secondary min-h-9 px-3 py-1 text-sm"
            onClick={openDeleteManager}
            disabled={allTodos.length === 0}
          >
            <ListChecks size={15} />
            선택 삭제
          </button>
        </div>
      </section>

      <div className="sticky top-[76px] z-20 -mx-1 rounded-xl bg-ink-950/90 px-1 py-2 backdrop-blur-xl">
        <TodoFilter filters={filters} onChange={setFilters} tagOptions={tagOptions} categories={categories} />
      </div>

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
        emptyTitle="아직 등록된 Todo가 없습니다."
        emptyDescription="검색 조건을 바꾸거나 새로운 Todo를 추가해보세요."
        includeEmptyCategories
      />

      {showDeleteManager ? (
        <Modal
          title="Todo 선택 삭제"
          description="삭제 모드에서 현재 검색 결과나 전체 Todo를 선택한 뒤 필요한 항목만 삭제합니다."
          onClose={closeDeleteManager}
          size="lg"
        >
          <div className="space-y-4">
            <div className="flex flex-col gap-3 rounded-lg bg-ink-950/45 p-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-bold text-ink-100">{selectedIds.size}개 선택됨</p>
                <p className="mt-1 text-xs text-ink-400">보관된 Todo도 ‘모든 Todo 선택’에 포함됩니다.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="btn-secondary min-h-9 px-3 py-1 text-xs"
                  onClick={() => selectTodos(filteredTodos)}
                  disabled={filteredTodos.length === 0 || deleting}
                >
                  현재 결과 {filteredTodos.length}개 선택
                </button>
                <button
                  type="button"
                  className="btn-secondary min-h-9 px-3 py-1 text-xs"
                  onClick={() => selectTodos(allTodos)}
                  disabled={allTodos.length === 0 || deleting}
                >
                  모든 Todo {allTodos.length}개 선택
                </button>
                <button
                  type="button"
                  className="btn-secondary min-h-9 px-3 py-1 text-xs"
                  onClick={() => setSelectedIds(new Set())}
                  disabled={selectedIds.size === 0 || deleting}
                >
                  선택 해제
                </button>
              </div>
            </div>

            <div className="max-h-[52vh] space-y-2 overflow-y-auto pr-1" aria-label="삭제할 Todo 선택 목록">
              {allTodos.map((todo) => {
                const checked = selectedIds.has(todo.id);
                return (
                  <label
                    key={todo.id}
                    className={`flex cursor-pointer items-start gap-3 rounded-lg px-3 py-2.5 transition ${
                      checked
                        ? "bg-danger/10 ring-1 ring-danger/45"
                        : "bg-ink-950/35 hover:bg-ink-800/80"
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="mt-1 h-4 w-4 shrink-0 accent-red-500"
                      checked={checked}
                      onChange={() => toggleSelected(todo.id)}
                      disabled={deleting}
                    />
                    <span className="min-w-0 flex-1">
                      <span className={`block break-words text-sm font-semibold ${todo.completed ? "text-ink-400 line-through" : "text-ink-100"}`}>
                        {todo.title}
                      </span>
                      <span className="mt-1 flex flex-wrap gap-x-2 gap-y-1 text-xs text-ink-400">
                        <span>{todo.date}</span>
                        <span>{todo.category?.name || "미분류"}</span>
                        {todo.completed ? <span>완료</span> : <span>미완료</span>}
                        {todo.archived ? <span className="text-amber-200">보관됨</span> : null}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>

            {deleteError ? (
              <p className="rounded-lg border border-danger/45 bg-danger/10 px-3 py-2 text-sm text-red-100" role="alert">
                {deleteError}
              </p>
            ) : null}

            <div className="flex flex-col-reverse gap-2 border-t border-ink-700/60 pt-4 sm:flex-row sm:justify-end">
              <button type="button" className="btn-secondary" onClick={closeDeleteManager} disabled={deleting}>
                취소
              </button>
              <button
                type="button"
                className="btn-danger"
                onClick={deleteSelected}
                disabled={selectedIds.size === 0 || deleting}
              >
                <Trash2 size={16} />
                {deleting ? "삭제 중..." : `선택 ${selectedIds.size}개 삭제`}
              </button>
            </div>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
