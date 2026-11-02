import { useState } from "react";
import { Plus, X } from "lucide-react";
import { InlineTodoAdd } from "../todo/InlineTodoAdd";
import type { Category } from "../../types/category";
import type { Todo, TodoInput } from "../../types/todo";
import type { CalendarEvent } from "../../lib/calendarEvents";
import { formatKoreanDate } from "../../lib/date";
import { IconRenderer } from "../common/IconRenderer";
import { TodoRow } from "../todo/TodoRow";
import { TodoEditModal } from "../todo/TodoEditModal";

type MonthlySidePanelProps = {
  selectedDate: string;
  monthEndLabel: string | null;
  selectedTodos: Todo[];
  selectedEvents: CalendarEvent[];
  categories: Category[];
  quickAdd: boolean;
  onCancelQuickAdd: () => void;
  onStartQuickAdd: () => void;
  movingTodoId: string | null;
  onMoveTodo: (id: string, dateKey: string) => Promise<boolean>;
  onClose: () => void;
  onAdd: (todo: TodoInput) => Promise<Todo | undefined> | Todo | undefined;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onUpdate: (id: string, updates: Partial<Omit<Todo, "id" | "createdAt">>) => void;
  onAddCategory: (input: { name: string; description?: string; color?: string; icon?: string }) => void | Promise<void>;
  onUpdateCategory: (id: string, input: Partial<Category>) => void | Promise<void>;
  onDeleteCategory: (id: string, mode: "moveTodos" | "deleteTodos") => void | Promise<void>;
};

const eventLabel: Record<CalendarEvent["kind"], string> = {
  todo: "실행 Todo",
  deadline: "Todo 마감",
  milestone: "마일스톤",
  project: "프로젝트 목표일",
};


function CalendarDateMoveRow({ todo, busy, onMove }: {
  todo: Todo;
  busy: boolean;
  onMove: (id: string, dateKey: string) => Promise<boolean>;
}) {
  const [targetDate, setTargetDate] = useState(todo.date);
  return (
    <div className="flex flex-col gap-2 border-b border-ink-700/35 p-2">
      <p className="truncate text-xs font-semibold text-ink-200" title={todo.title}>{todo.title}</p>
      <div className="flex flex-wrap items-center gap-2">
        <label className="min-w-0 flex-1">
          <span className="sr-only">{todo.title} 변경할 실행일</span>
          <input type="date" className="field min-w-0" value={targetDate} onChange={(event) => setTargetDate(event.target.value)}
            aria-label={`${todo.title} 변경할 실행일`} disabled={busy} />
        </label>
        <button type="button" className="btn-secondary min-h-9 shrink-0 text-xs" disabled={busy || !targetDate || targetDate === todo.date}
          onClick={() => void onMove(todo.id, targetDate)}>
          {busy ? "이동 중..." : "날짜 변경"}
        </button>
      </div>
    </div>
  );
}

export function MonthlySidePanel({
  selectedDate,
  monthEndLabel,
  selectedTodos,
  selectedEvents,
  categories,
  quickAdd,
  onCancelQuickAdd,
  onStartQuickAdd,
  movingTodoId,
  onMoveTodo,
  onClose,
  onAdd,
  onToggle,
  onDelete,
  onUpdate,
  onAddCategory,
  onUpdateCategory,
  onDeleteCategory,
}: MonthlySidePanelProps) {
  const [editingTodo, setEditingTodo] = useState<Todo | null>(null);
  const relatedEvents = selectedEvents.filter((event) => event.kind !== "todo");
  const completedCount = selectedTodos.filter((todo) => todo.completed).length;
  const categoryIds = new Set(categories.map((category) => category.id));
  const groups: Array<{ key: string; category: Category | undefined; todos: Todo[] }> = categories
    .filter((category) => selectedTodos.some((todo) => todo.categoryId === category.id))
    .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, "ko"))
    .map((category) => ({
      key: category.id,
      category,
      todos: selectedTodos.filter((todo) => todo.categoryId === category.id),
    }));
  const uncategorized = selectedTodos.filter((todo) => !todo.categoryId || !categoryIds.has(todo.categoryId));
  if (uncategorized.length) groups.push({ key: "uncategorized", category: undefined, todos: uncategorized });
  return (
    <aside className="scroll-mt-24" aria-label="선택한 날짜 상세">
      <section className="calendar-selected-panel flex flex-col border-l border-ui-divider px-4 py-3 xl:max-h-[calc(100vh-7rem)] xl:overflow-hidden">
        <div className="mb-3 flex items-start justify-between gap-2 border-b border-ui-divider pb-3">
          <div className="min-w-0">
            <h3 className="truncate text-base font-semibold text-ink-100">{formatKoreanDate(selectedDate)}</h3>
            <p className="mt-1 truncate text-xs text-ink-400">
              {selectedTodos.length}개 작업 · {completedCount}개 완료{monthEndLabel ? ` · ${monthEndLabel}` : ""}
            </p>
          </div>
          <button type="button" className="icon-btn h-9 w-9 shrink-0" onClick={onClose} aria-label="날짜 상세 닫기"><X size={16} /></button>
        </div>
        <div className="min-h-0 space-y-4 xl:overflow-y-auto xl:overscroll-contain xl:pr-1">
          {relatedEvents.length ? (
            <section aria-label="마감 및 프로젝트 일정" className="space-y-2">
              <h4 className="text-xs font-semibold text-ink-300">마감·프로젝트 일정</h4>
              <ul className="space-y-1.5">
                {relatedEvents.map((event) => (
                  <li key={event.id} className={`border-b border-ink-700/35 px-1 py-2 ${event.completed ? "opacity-60" : ""}`}>
                    <span className="block text-[11px] font-semibold text-ink-400">{eventLabel[event.kind]}</span>
                    <span className={`block break-words text-xs text-ink-200 ${event.completed ? "line-through" : ""}`}>{event.title}</span>
                    {event.projectName && event.kind === "milestone" ? <span className="mt-0.5 block text-[11px] text-ink-500">{event.projectName}</span> : null}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          <section aria-label="선택한 날짜 실행 Todo" className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h4 className="text-sm font-semibold text-ink-200">할 일</h4>
              <button type="button" className="inline-flex min-h-8 items-center gap-1 border border-ui-divider px-2 text-xs text-ui-secondary hover:border-ui-control-border hover:text-ui-text" onClick={onStartQuickAdd}>
                <Plus size={14} aria-hidden="true" /> 추가
              </button>
            </div>
            {quickAdd ? (
              <InlineTodoAdd key={selectedDate} defaultDate={selectedDate} placeholder="이 날짜에 추가할 Todo" onAdd={onAdd} onCancel={onCancelQuickAdd} />
            ) : null}
            {selectedTodos.length ? (
              <>
                {groups.map((group) => {
                  const done = group.todos.filter((todo) => todo.completed).length;
                  return (
                    <div key={group.key} className="calendar-day-group">
                      <div className="calendar-day-group__heading">
                        {group.category ? (
                          <IconRenderer
                            icon={group.category.icon}
                            color={group.category.color || "#a0a0a6"}
                            name={group.category.name}
                            className={group.category.icon ? "h-6 w-6 border-0 bg-transparent" : "h-2 w-2"}
                            iconClassName="h-4 w-4"
                            fallback="dot"
                          />
                        ) : null}
                        <span className="min-w-0 truncate">{group.category?.name || "미분류"}</span>
                        <span className="ml-auto text-xs font-normal tabular-nums text-ui-muted">{done}/{group.todos.length}</span>
                      </div>
                      <div className="calendar-day-group__list">
                        {group.todos.map((todo) => (
                          <TodoRow
                            key={todo.id}
                            todo={todo}
                            variant="today"
                            onToggle={onToggle}
                            onDelete={onDelete}
                            onEdit={setEditingTodo}
                            showDate={false}
                            showCategoryBadge={false}
                            hideMediumPriority
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}
                <details className="calendar-date-move border-t border-ui-divider pt-2">
                  <summary className="cursor-pointer py-2 text-xs text-ui-secondary hover:text-ui-text">날짜 빠르게 변경</summary>
                  <div className="mt-1 space-y-1">
                    {selectedTodos.filter((todo) => !todo.completed).map((todo) => (
                      <CalendarDateMoveRow key={todo.id} todo={todo} busy={movingTodoId !== null} onMove={onMoveTodo} />
                    ))}
                  </div>
                </details>
              </>
            ) : (
              <p className="border-t border-ui-divider py-5 text-sm text-ui-muted">이 날짜에 예정된 할 일이 없습니다.</p>
            )}
          </section>
        </div>
      </section>
      <TodoEditModal todo={editingTodo} categories={categories} onClose={() => setEditingTodo(null)} onSave={onUpdate} />
    </aside>
  );
}
