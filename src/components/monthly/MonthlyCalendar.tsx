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

const baseCellTone = "border-ink-700/65 bg-ink-950/35";

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
    <section className="app-card p-3 sm:p-4">
      <div className="mb-3 grid grid-cols-[2.25rem_minmax(0,1fr)_2.25rem] items-center gap-2">
        <button
          type="button"
          className="icon-btn h-9 w-9"
          onClick={() => onMonthChange(getPrevMonth(currentMonth))}
          aria-label="이전 달"
        >
          <ChevronLeft size={17} />
        </button>
        <h2 className="truncate text-center text-lg font-bold text-ink-100">
          {formatKoreanDate(currentMonth, "yyyy년 M월")}
        </h2>
        <button
          type="button"
          className="icon-btn h-9 w-9"
          onClick={() => onMonthChange(getNextMonth(currentMonth))}
          aria-label="다음 달"
        >
          <ChevronRight size={17} />
        </button>
      </div>

      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-[10px] text-ink-500">
        <p>날짜를 선택하면 오른쪽에서 Todo를 자세히 관리합니다.</p>
        <p className="font-medium" aria-label="일일 수행 상태 범례">O 완료 · X 미수행 · - 미설정</p>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold text-ink-500 sm:gap-1.5">
        {weekdayLabels.map((label, index) => (
          <div
            key={label}
            className={`py-1 ${index === 5 ? "text-sky-400/55" : index === 6 ? "text-red-400/55" : ""}`}
          >
            {label}
          </div>
        ))}
      </div>

      <div className="mt-1 grid grid-cols-7 gap-1 sm:gap-1.5">
        {monthDays.map((day) => {
          const dateKey = toDateKey(day);
          const dayTodos = getTodosByDate(dateKey);
          const activeCount = dayTodos.filter((todo) => !todo.completed).length;
          const completedCount = dayTodos.length - activeCount;
          const dayGoals = goals.filter((goal) => goal.type === "DAILY" && !isDayStatusGoal(goal) && (goal.targetDate === dateKey || goal.dueDate === dateKey));
          const categoryColors = Array.from(new Set(dayTodos.map((todo) => todo.category?.color).filter(Boolean)));
          const selected = dateKey === selectedDate;
          const today = isTodayDate(day);
          const inMonth = isCurrentMonth(day, currentMonth);
          const dayStatus = getDayStatus(goals, dateKey);
          const holidayName = getKoreanHolidayName(dateKey);
          const dayIndex = getDayIndex(day);
          const isSaturday = dayIndex === 6;
          const isSunday = dayIndex === 0;
          const dateTone = holidayName
            ? "text-red-300/75"
            : isSunday
              ? "text-red-400/60"
              : isSaturday
                ? "text-sky-400/60"
                : "text-ink-100";
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
              className={`group relative h-[6.25rem] overflow-hidden rounded-md border text-left transition sm:h-[7rem] ${
                selected
                  ? "border-accent-500/90 bg-accent-500/[0.09] ring-1 ring-accent-500/25"
                  : `${baseCellTone} hover:border-ink-500/80 hover:bg-ink-900/60`
              } ${inMonth ? "" : "opacity-40"} ${today && !selected ? "ring-1 ring-accent-400/40" : ""}`}
            >
              <button
                type="button"
                className="absolute inset-0 z-0 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent-500/45"
                onClick={() => onSelectDate(dateKey)}
                aria-label={`${formattedDate} Todo 보기`}
              />

              <div className="pointer-events-none relative z-10 flex h-full min-w-0 flex-col px-1.5 py-1.5 sm:px-2 sm:py-2">
                <div className="min-w-0 pr-7">
                  <div className="flex min-w-0 items-center gap-1">
                    <span className={`shrink-0 text-xs font-bold sm:text-sm ${dateTone}`}>{formatKoreanDate(day, "d")}</span>
                    {today ? (
                      <span className="hidden rounded-full border border-accent-500/35 bg-accent-500/12 px-1.5 py-0.5 text-[9px] font-bold text-accent-300 sm:inline-flex">
                        오늘
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-0.5 min-h-3 truncate text-[9px] font-semibold sm:text-[10px]">
                    {holidayName ? <span className="text-red-300/65">{holidayName}</span> : null}
                  </div>
                </div>

                <div className="mt-auto min-w-0 space-y-0.5">
                  {dayTodos.length ? (
                    <>
                      <div className="flex min-w-0 items-baseline justify-between gap-1">
                        <span className="truncate text-[10px] font-bold text-ink-200 sm:text-[11px]">Todo {dayTodos.length}</span>
                        <span className="hidden shrink-0 text-[9px] text-ink-500 sm:inline">미완료 {activeCount}</span>
                      </div>
                      <p className="hidden truncate text-[9px] text-ink-600 sm:block">완료 {completedCount}{dayGoals.length ? ` · 목표 ${dayGoals.length}` : ""}</p>
                    </>
                  ) : dayGoals.length ? (
                    <p className="truncate text-[9px] font-semibold text-amber-200/70 sm:text-[10px]">목표 {dayGoals.length}</p>
                  ) : (
                    <p className="text-[9px] text-ink-700 sm:text-[10px]">Todo 없음</p>
                  )}

                  {categoryColors.length ? (
                    <div className="flex items-center gap-1 pt-0.5">
                      {categoryColors.slice(0, 3).map((color) => (
                        <span key={color} className="h-1.5 w-1.5 rounded-full opacity-80" style={{ background: color }} />
                      ))}
                      {categoryColors.length > 3 ? <span className="text-[9px] text-ink-600">+{categoryColors.length - 3}</span> : null}
                    </div>
                  ) : null}
                </div>
              </div>

              <button
                type="button"
                className={`absolute right-1 top-1 z-20 inline-flex h-7 w-7 items-center justify-center rounded-md border text-[10px] font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/45 sm:right-1.5 sm:top-1.5 ${
                  dayStatus === "O"
                    ? "border-success/30 bg-success/[0.06] text-emerald-200/85 hover:border-success/55 hover:bg-success/10"
                    : dayStatus === "X"
                      ? "border-danger/30 bg-danger/[0.06] text-red-200/85 hover:border-danger/55 hover:bg-danger/10"
                      : "border-ink-700/80 bg-ink-950/65 text-ink-500 hover:border-ink-500 hover:text-ink-200"
                }`}
                onClick={() => onCycleDayStatus(dateKey)}
                aria-label={statusActionLabel}
                title="O → X → 미설정"
              >
                {dayStatus || "-"}
              </button>
            </article>
          );
        })}
      </div>
    </section>
  );
}
