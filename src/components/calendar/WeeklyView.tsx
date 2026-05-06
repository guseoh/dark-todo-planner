import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { calculateRate } from "../../lib/todo";
import { formatKoreanDate, getWeekDays, toDateKey, todayKey } from "../../lib/date";
import type { Todo, TodoInput } from "../../types/todo";
import { ProgressBar } from "../common/ProgressBar";
import { TodoForm } from "../todo/TodoForm";
import { TodoList } from "../todo/TodoList";
import { PriorityBadge } from "../todo/PriorityBadge";

type WeeklyViewProps = {
  todos: Todo[];
  onAdd: (todo: TodoInput) => void;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onUpdate: (id: string, updates: Partial<Omit<Todo, "id" | "createdAt">>) => void;
};

export function WeeklyView({ todos, onAdd, onToggle, onDelete, onUpdate }: WeeklyViewProps) {
  const [selectedDate, setSelectedDate] = useState(todayKey());
  const weekDays = useMemo(() => getWeekDays(), []);
  const selectedTodos = todos.filter((todo) => todo.date === selectedDate);
  const weekRate = calculateRate(todos);

  return (
    <div className="space-y-5">
      <section className="app-card p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-ink-400">이번 주 완료율</p>
            <h2 className="mt-1 text-2xl font-bold text-ink-100">{weekRate}%</h2>
          </div>
          <div className="w-full max-w-md">
            <ProgressBar value={weekRate} label={`${todos.length}개 중 ${todos.filter((todo) => todo.completed).length}개 완료`} />
          </div>
        </div>
      </section>

      <section className="grid gap-3 xl:grid-cols-7">
        {weekDays.map((day) => {
          const dateKey = toDateKey(day);
          const dayTodos = todos.filter((todo) => todo.date === dateKey);
          const isToday = dateKey === todayKey();
          const isSelected = dateKey === selectedDate;

          return (
            <button
              key={dateKey}
              type="button"
              onClick={() => setSelectedDate(dateKey)}
              className={`app-card min-h-48 p-4 text-left transition hover:border-accent-500/60 ${
                isSelected ? "border-accent-500/70 bg-accent-500/10" : ""
              } ${isToday ? "ring-2 ring-accent-400/30" : ""}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-ink-100">{formatKoreanDate(day, "E요일")}</p>
                  <p className="mt-1 text-xs text-ink-400">{formatKoreanDate(day, "M월 d일")}</p>
                </div>
                <span className="rounded-full border border-ink-700 bg-ink-950/70 px-2 py-1 text-xs text-ink-300">
                  {dayTodos.length}개
                </span>
              </div>
              <div className="mt-4 space-y-2">
                {dayTodos.slice(0, 4).map((todo) => (
                  <div key={todo.id} className={`rounded-md border border-ink-700 bg-ink-950/50 p-2 ${todo.completed ? "opacity-50" : ""}`}>
                    <p className={`truncate text-sm font-medium text-ink-100 ${todo.completed ? "line-through" : ""}`}>{todo.title}</p>
                    <div className="mt-2">
                      <PriorityBadge priority={todo.priority} />
                    </div>
                  </div>
                ))}
                {dayTodos.length === 0 ? <p className="text-sm text-ink-500">계획 없음</p> : null}
                {dayTodos.length > 4 ? <p className="text-xs text-ink-500">+{dayTodos.length - 4}개 더 있음</p> : null}
              </div>
            </button>
          );
        })}
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Plus size={18} className="text-accent-400" />
            <h3 className="font-semibold text-ink-100">{formatKoreanDate(selectedDate, "M월 d일 EEEE")}에 추가</h3>
          </div>
          <TodoForm onAdd={onAdd} defaultDate={selectedDate} compact />
        </div>
        <div className="space-y-4">
          <h3 className="font-semibold text-ink-100">선택한 날짜 Todo</h3>
          <TodoList
            todos={selectedTodos}
            onToggle={onToggle}
            onDelete={onDelete}
            onUpdate={onUpdate}
            emptyTitle="이번 주 계획이 없습니다."
            emptyDescription="선택한 날짜에 새로운 Todo를 추가해보세요."
            groupByCompletion
            showDate={false}
          />
        </div>
      </section>
    </div>
  );
}
