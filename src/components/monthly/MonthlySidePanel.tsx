import { useState } from "react";
import { X } from "lucide-react";
import { InlineTodoAdd } from "../todo/InlineTodoAdd";
import type { Category } from "../../types/category";
import type { Todo, TodoInput } from "../../types/todo";
import type { CalendarEvent } from "../../lib/calendarEvents";
import { formatKoreanDate } from "../../lib/date";
import { GroupedTodoList } from "../todo/GroupedTodoList";

type MonthlySidePanelProps = {
  selectedDate: string;
  monthEndLabel: string | null;
  selectedTodos: Todo[];
  selectedEvents: CalendarEvent[];
  categories: Category[];
  quickAdd: boolean;
  onCancelQuickAdd: () => void;
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
  const relatedEvents = selectedEvents.filter((event) => event.kind !== "todo");
  return (
    <aside className="scroll-mt-24" aria-label="선택한 날짜 상세">
      <section className="app-card flex flex-col p-4 xl:max-h-[calc(100vh-7rem)] xl:overflow-hidden">
        <div className="mb-4 flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold text-ink-100">선택한 날짜</h3>
            <p className="mt-1 truncate text-xs text-ink-400">
              {formatKoreanDate(selectedDate)}
              {monthEndLabel ? ` · ${monthEndLabel}` : ""}
            </p>
          </div>
          <button type="button" className="icon-btn h-9 w-9 shrink-0" onClick={onClose} aria-label="날짜 상세 닫기"><X size={16} /></button>
        </div>
        <div className="min-h-0 space-y-4 xl:overflow-y-auto xl:overscroll-contain xl:pr-1 [&_.icon-btn]:!min-h-9 [&_.icon-btn]:!min-w-9">
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
          <section aria-label="선택한 날짜 실행 Todo" className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <h4 className="text-xs font-semibold text-ink-300">실행 Todo</h4>
              <span className="px-1 py-0.5 text-xs text-ink-400">{selectedTodos.length}개</span>
            </div>
            {quickAdd ? (
              <InlineTodoAdd key={selectedDate} defaultDate={selectedDate} placeholder="이 날짜에 추가할 Todo" onAdd={onAdd} onCancel={onCancelQuickAdd} />
            ) : null}
            {selectedTodos.length ? (
              <details className="border-t border-ink-700/50 p-2.5">
                <summary className="cursor-pointer text-xs font-semibold text-ink-300">빠른 날짜 변경 · ${selectedTodos.length}개</summary>
                <div className="mt-3 space-y-2">
                  {selectedTodos.map((todo) => (
                    <CalendarDateMoveRow key={todo.id} todo={todo} busy={movingTodoId !== null} onMove={onMoveTodo} />
                  ))}
                </div>
              </details>
            ) : null}
            <GroupedTodoList
              todos={selectedTodos}
              categories={categories}
              onAddTodo={onAdd}
              onToggle={onToggle}
              onDelete={onDelete}
              onUpdate={onUpdate}
              onAddCategory={onAddCategory}
              onUpdateCategory={onUpdateCategory}
              onDeleteCategory={onDeleteCategory}
              emptyTitle="이 날짜에 실행할 Todo가 없습니다."
              emptyDescription="날짜별 Todo를 추가하거나 계획을 이동할 수 있습니다."
              showDate={false}
              defaultDate={selectedDate}
              showCategoryCreator={false}
              layout="list"
            />
          </section>
        </div>
      </section>
    </aside>
  );
}
