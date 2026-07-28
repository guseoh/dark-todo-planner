import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  formatKoreanDate,
  getDayIndex,
  getKoreanHolidayName,
  getNextMonth,
  getPrevMonth,
  isCurrentMonth,
  isTodayDate,
  toDateKey,
  weekdayLabels,
} from "../../lib/date";
import type { Goal } from "../../types/goal";
import type { Todo } from "../../types/todo";
import { getDayStatus, isDayStatusGoal } from "../../lib/goals";

type MonthlyCalendarProps = {
  currentMonth: Date;
  monthDays: Date[];
  selectedDate: string;
  goals: Goal[];
  getTodosByDate: (date: string) => Todo[];
  onMonthChange: (date: Date) => void;
  onSelectDate: (date: string) => void;
  onCycleDayStatus: (date: string) => void;
};

export function MonthlyCalendar({
  currentMonth,
  monthDays,
  selectedDate,
  goals,
  getTodosByDate,
  onMonthChange,
  onSelectDate,
  onCycleDayStatus,
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

      <p className="mb-3 text-right text-[11px] font-medium text-ink-400" aria-label="일일 수행 상태 범례">
        O 수행 완료 · X 미수행 · - 미설정
      </p>

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
          const dayGoals = goals.filter((goal) => goal.type === "DAILY" && !isDayStatusGoal(goal) && (goal.targetDate === dateKey || goal.dueDate === dateKey));
          const categoryColors = Array.from(new Set(dayTodos.map((todo) => todo.category?.color).filter(Boolean)));
          const selected = dateKey === selectedDate;
          const today = isTodayDate(day);
          const inMonth = isCurrentMonth(day, currentMonth);
          const dayStatus = getDayStatus(goals, dateKey);
          const holidayName = getKoreanHolidayName(dateKey);
          const dayIndex = getDayIndex(day);
          const isSaturday = dayIndex === 6;
          const isHolidayLike = dayIndex === 0 || !!holidayName;
          const dateTone = isHolidayLike ? "text-red-200" : isSaturday ? "text-sky-200" : "text-ink-100";
          const borderTone = isHolidayLike ? "border-red-400/25" : isSaturday ? "border-sky-400/25" : "border-ink-700";
          const statusTone =
            dayStatus === "O"
              ? "border-emerald-400/45 bg-emerald-500/10"
              : dayStatus === "X"
                ? "border-rose-400/45 bg-rose-500/10"
                : `${borderTone} bg-ink-950/40`;
          const selectedTone =
            dayStatus === "O"
              ? "border-accent-500 bg-emerald-500/15"
              : dayStatus === "X"
                ? "border-accent-500 bg-rose-500/15"
                : "border-accent-500 bg-accent-500/10";
          const formattedDate = formatKoreanDate(day, "M월 d일");
          const statusActionLabel =
            dayStatus === "O"
              ? `${formattedDate}, 현재 수행 완료. 클릭하면 미수행으로 변경`
              : dayStatus === "X"
                ? `${formattedDate}, 현재 미수행. 클릭하면 미설정으로 변경`
                : `${formattedDate}, 현재 미설정. 클릭하면 수행 완료로 변경`;

          return (
            <article
              key={dateKey}
              className={`group relative min-h-[5.8rem] cursor-pointer rounded-lg border p-1.5 text-left transition hover:border-accent-500/60 sm:min-h-[6.8rem] sm:p-2 lg:min-h-[7.2rem] ${
                selected ? selectedTone : statusTone
              } ${inMonth ? "text-ink-100" : "text-ink-600"} ${today ? "ring-2 ring-accent-400/30" : ""}`}
            >
              <button
                type="button"
                className="absolute inset-0 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-ink-950"
                onClick={() => onSelectDate(dateKey)}
                aria-label={`${formattedDate} Todo 보기`}
              />

              <div className="pointer-events-none relative z-[1]">
                <div className="flex min-w-0 flex-wrap items-start justify-between gap-1">
                  <span className={`text-sm font-semibold leading-5 ${dateTone}`}>{formatKoreanDate(day, "d")}</span>
                  <div className="flex min-w-0 flex-wrap justify-end gap-1 text-right">
                    {today ? (
                      <span className="rounded-full bg-accent-500 px-1.5 py-0.5 text-[10px] font-bold leading-4 text-white">
                        오늘
                      </span>
                    ) : null}
                    <button
                      type="button"
                      className={`pointer-events-auto relative z-10 inline-flex h-8 min-w-8 items-center justify-center rounded-full border px-1 text-[10px] font-bold leading-4 transition hover:border-accent-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/50 ${
                        dayStatus === "O"
                          ? "border-success/45 bg-success/10 text-emerald-100"
                          : dayStatus === "X"
                            ? "border-danger/45 bg-danger/10 text-red-100"
                            : "border-ink-700 bg-transparent text-ink-500"
                      }`}
                      onClick={() => onCycleDayStatus(dateKey)}
                      aria-label={statusActionLabel}
                      title="O → X → 미설정"
                    >
                      {dayStatus || "-"}
                    </button>
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

                <div className="mt-1 flex min-w-0 flex-wrap items-center gap-1">
                  {holidayName ? <span className="truncate text-[10px] font-semibold text-red-200/80">{holidayName}</span> : null}
                  {isSaturday && !holidayName ? <span className="text-[10px] font-semibold text-sky-200/75">토요일</span> : null}
                  {isHolidayLike && !holidayName ? <span className="text-[10px] font-semibold text-red-200/75">일요일</span> : null}
                </div>

                {categoryColors.length ? (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {categoryColors.slice(0, 3).map((color) => (
                      <span key={color} className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
                    ))}
                    {categoryColors.length > 3 ? <span className="text-[10px] leading-4 text-ink-500">+{categoryColors.length - 3}</span> : null}
                  </div>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
