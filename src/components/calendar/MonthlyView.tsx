import { useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import {
  formatKoreanDate,
  getMonthGrid,
  getNextMonth,
  getPrevMonth,
  isCurrentMonth,
  isTodayDate,
  toDateKey,
  todayKey,
  weekdayLabels,
} from "../../lib/date";
import type { Todo, TodoInput } from "../../types/todo";
import { TodoForm } from "../todo/TodoForm";
import { TodoList } from "../todo/TodoList";

type MonthlyViewProps = {
  todos: Todo[];
  getTodosByDate: (date: string) => Todo[];
  onAdd: (todo: TodoInput) => void;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onUpdate: (id: string, updates: Partial<Omit<Todo, "id" | "createdAt">>) => void;
  onArchive: (id: string) => void;
  onFocusTodo: (todo: Todo) => void;
};

export function MonthlyView({ todos, getTodosByDate, onAdd, onToggle, onDelete, onUpdate, onArchive, onFocusTodo }: MonthlyViewProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(todayKey());
  const selectedPanelRef = useRef<HTMLElement | null>(null);
  const monthDays = useMemo(() => getMonthGrid(currentMonth), [currentMonth]);
  const selectedTodos = getTodosByDate(selectedDate);

  const selectDate = (dateKey: string) => {
    setSelectedDate(dateKey);
    if (window.innerWidth < 1280) {
      window.requestAnimationFrame(() => {
        selectedPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
  };

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)]">
      <section className="app-card p-4 sm:p-5">
        <div className="mb-5 flex items-center justify-between gap-3">
          <button type="button" className="icon-btn" onClick={() => setCurrentMonth((date) => getPrevMonth(date))} aria-label="이전 달">
            <ChevronLeft size={18} />
          </button>
          <h2 className="text-lg font-bold text-ink-100 sm:text-xl">{formatKoreanDate(currentMonth, "yyyy년 M월")}</h2>
          <button type="button" className="icon-btn" onClick={() => setCurrentMonth((date) => getNextMonth(date))} aria-label="다음 달">
            <ChevronRight size={18} />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-ink-500 sm:gap-2">
          {weekdayLabels.map((label) => (
            <div key={label} className="py-2">
              {label}
            </div>
          ))}
        </div>

        <div className="mt-1 grid grid-cols-7 gap-1 sm:gap-2">
          {monthDays.map((day) => {
            const dateKey = toDateKey(day);
            const dayTodos = getTodosByDate(dateKey);
            const selected = dateKey === selectedDate;
            const today = isTodayDate(day);
            const inMonth = isCurrentMonth(day, currentMonth);

            return (
              <button
                key={dateKey}
                type="button"
                onClick={() => selectDate(dateKey)}
                className={`min-h-24 rounded-lg border p-2 text-left transition hover:border-accent-500/60 sm:min-h-32 ${
                  selected
                    ? "border-accent-500 bg-accent-500/10"
                    : "border-ink-700 bg-ink-950/40"
                } ${inMonth ? "text-ink-100" : "text-ink-600"} ${today ? "ring-2 ring-accent-400/30" : ""}`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold">{formatKoreanDate(day, "d")}</span>
                  {dayTodos.length ? (
                    <span className="rounded-full bg-accent-500/20 px-2 py-0.5 text-[11px] font-semibold text-accent-400">
                      {dayTodos.length}
                    </span>
                  ) : null}
                </div>
                <div className="mt-2 hidden space-y-1 sm:block">
                  {dayTodos.slice(0, 3).map((todo) => (
                    <p key={todo.id} className={`truncate text-xs ${todo.completed ? "text-ink-600 line-through" : "text-ink-300"}`}>
                      {todo.title}
                    </p>
                  ))}
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <aside ref={selectedPanelRef} className="scroll-mt-24 space-y-5">
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Plus size={18} className="text-accent-400" />
            <h3 className="font-semibold text-ink-100">{formatKoreanDate(selectedDate, "M월 d일 EEEE")}에 추가</h3>
          </div>
          <TodoForm onAdd={onAdd} defaultDate={selectedDate} compact />
        </section>
        <section className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-semibold text-ink-100">선택한 날짜 Todo</h3>
            <span className="rounded-full border border-ink-700 bg-ink-950/70 px-2.5 py-1 text-xs text-ink-400">
              {selectedTodos.length}개
            </span>
          </div>
          <TodoList
            todos={selectedTodos}
            onToggle={onToggle}
            onDelete={onDelete}
            onUpdate={onUpdate}
            onArchive={onArchive}
            onFocusTodo={onFocusTodo}
            emptyTitle="선택한 날짜의 Todo가 없습니다."
            emptyDescription="달력에서 날짜를 고른 뒤 Todo를 추가해보세요."
            groupByCompletion
            showDate={false}
          />
        </section>
      </aside>
    </div>
  );
}
