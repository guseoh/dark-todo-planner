import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  formatKoreanDate,
  getNextMonth,
  getPrevMonth,
  isCurrentMonth,
  isTodayDate,
  toDateKey,
  weekdayLabels,
} from "../../lib/date";
import type { Goal } from "../../types/goal";
import type { Todo } from "../../types/todo";

type MonthlyCalendarProps = {
  currentMonth: Date;
  monthDays: Date[];
  selectedDate: string;
  goals: Goal[];
  getTodosByDate: (date: string) => Todo[];
  onMonthChange: (date: Date) => void;
  onSelectDate: (date: string) => void;
};

export function MonthlyCalendar({
  currentMonth,
  monthDays,
  selectedDate,
  goals,
  getTodosByDate,
  onMonthChange,
  onSelectDate,
}: MonthlyCalendarProps) {
  return (
    <section className="app-card p-4 sm:p-5">
      <div className="mb-4 grid grid-cols-[2.5rem_minmax(0,1fr)_2.5rem] items-center gap-3">
        <button
          type="button"
          className="icon-btn"
          onClick={() => onMonthChange(getPrevMonth(currentMonth))}
          aria-label="이전 달"
        >
          <ChevronLeft size={18} />
        </button>
        <h2 className="truncate text-center text-lg font-bold text-ink-100 sm:text-xl">
          {formatKoreanDate(currentMonth, "yyyy년 M월")}
        </h2>
        <button
          type="button"
          className="icon-btn"
          onClick={() => onMonthChange(getNextMonth(currentMonth))}
          aria-label="다음 달"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-ink-500 sm:gap-2">
        {weekdayLabels.map((label) => (
          <div key={label} className="py-1.5">
            {label}
          </div>
        ))}
      </div>

      <div className="mt-1 grid grid-cols-7 gap-1 sm:gap-2">
        {monthDays.map((day) => {
          const dateKey = toDateKey(day);
          const dayTodos = getTodosByDate(dateKey);
          const dayGoals = goals.filter((goal) => goal.targetDate === dateKey || goal.dueDate === dateKey);
          const categoryColors = Array.from(new Set(dayTodos.map((todo) => todo.category?.color).filter(Boolean)));
          const selected = dateKey === selectedDate;
          const today = isTodayDate(day);
          const inMonth = isCurrentMonth(day, currentMonth);
          const hiddenTodoCount = Math.max(dayTodos.length - 2, 0);

          return (
            <button
              key={dateKey}
              type="button"
              onClick={() => onSelectDate(dateKey)}
              className={`min-h-[5.4rem] rounded-lg border p-2 text-left transition hover:border-accent-500/60 sm:min-h-[6.7rem] lg:min-h-[7.4rem] ${
                selected ? "border-accent-500 bg-accent-500/10" : "border-ink-700 bg-ink-950/40"
              } ${inMonth ? "text-ink-100" : "text-ink-600"} ${today ? "ring-2 ring-accent-400/30" : ""}`}
            >
              <div className="flex min-w-0 items-start justify-between gap-1">
                <span className="text-sm font-semibold leading-5">{formatKoreanDate(day, "d")}</span>
                <div className="flex min-w-0 flex-wrap justify-end gap-1">
                  {dayTodos.length ? (
                    <span className="rounded-full bg-accent-500/20 px-1.5 py-0.5 text-[10px] font-semibold leading-4 text-accent-400">
                      Todo {dayTodos.length}
                    </span>
                  ) : null}
                  {dayGoals.length ? (
                    <span className="rounded-full bg-warning/20 px-1.5 py-0.5 text-[10px] font-semibold leading-4 text-amber-100">
                      목표 {dayGoals.length}
                    </span>
                  ) : null}
                </div>
              </div>

              {categoryColors.length ? (
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {categoryColors.slice(0, 5).map((color) => (
                    <span key={color} className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
                  ))}
                  {categoryColors.length > 5 ? <span className="text-[10px] leading-4 text-ink-500">+{categoryColors.length - 5}</span> : null}
                </div>
              ) : null}

              <div className="mt-1.5 hidden space-y-0.5 sm:block">
                {dayTodos.slice(0, 2).map((todo) => (
                  <p key={todo.id} className={`truncate text-[11px] leading-4 ${todo.completed ? "text-ink-600 line-through" : "text-ink-300"}`}>
                    {todo.title}
                  </p>
                ))}
                {hiddenTodoCount ? <p className="text-[11px] leading-4 text-ink-500">+{hiddenTodoCount}개 더</p> : null}
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
