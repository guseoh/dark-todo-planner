import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import type { ReactNode } from "react";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
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
import type { CalendarEvent } from "../../lib/calendarEvents";
import type { Goal } from "../../types/goal";
import { getDayStatus, isDayStatusGoal } from "../../lib/goals";

type MonthlyCalendarProps = {
  currentMonth: Date;
  monthDays: Date[];
  selectedDate: string;
  goals: Goal[];
  eventsByDate: Map<string, CalendarEvent[]>;
  onMonthChange: (date: Date) => void;
  onToday: () => void;
  onSelectDate: (date: string) => void;
  onCycleDayStatus: (date: string) => void;
  onQuickAdd: (date: string) => void;
  onOpenTodo: (id: string) => void;
  draggingDisabled?: boolean;
};

const eventTone: Record<CalendarEvent["kind"], string> = {
  todo: "border-l-accent-600 bg-accent-500/10 text-ink-200",
  deadline: "border-l-warning bg-warning/10 text-amber-100",
  milestone: "border-l-ink-500 bg-ink-800/90 text-ink-200",
  project: "border-l-ink-400 bg-ink-850 text-ink-200",
};
const eventPrefix: Record<CalendarEvent["kind"], string> = {
  todo: "",
  deadline: "마감 · ",
  milestone: "◆ ",
  project: "프로젝트 · ",
};


function CalendarDropCell({ dateKey, disabled, children }: { dateKey: string; disabled: boolean; children: ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: dateKey, disabled, data: { dateKey } });
  return (
    <div ref={setNodeRef} data-calendar-date={dateKey} className={`min-w-0 ${isOver ? "rounded-lg ring-2 ring-accent-500/80" : ""}`}>
      {children}
    </div>
  );
}

function CalendarEventChip({ event, onClick, draggingDisabled, hiddenClass }: {
  event: CalendarEvent;
  onClick: () => void;
  draggingDisabled: boolean;
  hiddenClass: string;
}) {
  const draggable = event.kind === "todo" && Boolean(event.relatedTodoId);
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: event.id,
    disabled: !draggable || draggingDisabled,
    data: { todoId: event.relatedTodoId, date: event.date, kind: event.kind },
  });
  const prefix = event.kind === "todo" && event.dueOnDate ? "마감 · " : eventPrefix[event.kind];
  return (
    <button
      ref={setNodeRef}
      type="button"
      {...(draggable ? attributes : {})}
      {...(draggable ? listeners : {})}
      onClick={onClick}
      data-calendar-event={event.id}
      title={`${prefix}${event.title}${event.projectName ? ` · ${event.projectName}` : ""}`}
      aria-label={event.title}
      style={{ transform: CSS.Translate.toString(transform), touchAction: "pan-y", zIndex: isDragging ? 50 : undefined }}
      className={`pointer-events-auto relative block min-h-5 w-full min-w-0 truncate rounded-[4px] border-l-[3px] px-1 py-0.5 text-left text-[10px] leading-4 transition-colors hover:brightness-125 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 ${eventTone[event.kind]} ${event.completed ? "opacity-50 line-through" : ""} ${isDragging ? "cursor-grabbing shadow-lg opacity-70" : draggable ? "cursor-grab" : "cursor-pointer"} ${hiddenClass}`}
    >
      {prefix}{event.title}
    </button>
  );
}

export function MonthlyCalendar({
  currentMonth,
  monthDays,
  selectedDate,
  goals,
  eventsByDate,
  onMonthChange,
  onToday,
  onSelectDate,
  onCycleDayStatus,
  onQuickAdd,
  onOpenTodo,
  draggingDisabled = false,
}: MonthlyCalendarProps) {
  return (
    <section className="app-card min-w-0 p-2.5 sm:p-4" aria-label="월간 일정 캘린더">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h3 className="text-base font-bold text-ink-100 sm:text-lg">
            {formatKoreanDate(currentMonth, "yyyy년 M월")}
          </h3>
          <button type="button" className="btn-secondary min-h-8 px-2 text-xs" onClick={onToday}>오늘</button>
        </div>
        <div className="flex items-center gap-1" aria-label="달 이동">
          <button type="button" className="icon-btn h-9 w-9" onClick={() => onMonthChange(getPrevMonth(currentMonth))} aria-label="이전 달"><ChevronLeft size={17} /></button>
          <button type="button" className="icon-btn h-9 w-9" onClick={() => onMonthChange(getNextMonth(currentMonth))} aria-label="다음 달"><ChevronRight size={17} /></button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-ink-400 sm:gap-1.5">
        {weekdayLabels.map((label, index) => (
          <div key={label} className={`py-2 ${index === 6 ? "text-red-300/80" : ""}`}>{label}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
        {monthDays.map((day) => {
          const dateKey = toDateKey(day);
          const events = eventsByDate.get(dateKey) ?? [];
          const activeCount = events.filter((event) => !event.completed).length;
          const dayGoals = goals.filter((goal) =>
            goal.type === "DAILY"
            && !isDayStatusGoal(goal)
            && (goal.targetDate === dateKey || goal.dueDate === dateKey));
          const selected = dateKey === selectedDate;
          const today = isTodayDate(day);
          const inMonth = isCurrentMonth(day, currentMonth);
          const dayStatus = getDayStatus(goals, dateKey);
          const holidayName = getKoreanHolidayName(dateKey);
          const isSunday = getDayIndex(day) === 0;
          const formattedDate = formatKoreanDate(day, "M월 d일");
          const statusActionLabel = dayStatus === "O"
            ? `${formattedDate}, 현재 수행 완료. 클릭하면 미수행으로 변경`
            : dayStatus === "X"
              ? `${formattedDate}, 현재 미수행. 클릭하면 미설정으로 변경`
              : `${formattedDate}, 현재 미설정. 클릭하면 수행 완료로 변경`;
          return (
            <CalendarDropCell key={dateKey} dateKey={dateKey} disabled={draggingDisabled}>
            <article
              className={`group relative flex min-h-[6.5rem] min-w-0 flex-col overflow-hidden rounded-lg border p-1.5 transition-colors sm:min-h-[9rem] sm:p-2 ${
                selected
                  ? "border-accent-600/85 bg-accent-500/[0.075] ring-1 ring-accent-500/20"
                  : "border-ink-700/45 bg-ink-950/30 hover:border-ink-600/70 hover:bg-ink-850/70"
              } ${!inMonth ? "opacity-60" : ""} ${today && !selected ? "ring-1 ring-accent-600/45" : ""}`}
            >
              <button type="button" className="absolute inset-0 z-0 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent-500/60"
                onClick={() => onSelectDate(dateKey)} aria-label={`${formattedDate} 일정 ${events.length}개 보기`} />
              <div className="pointer-events-none relative z-10 flex h-full min-w-0 flex-1 flex-col">
                <div className="flex min-w-0 items-center justify-between gap-1">
                  <span className={`inline-flex h-6 min-w-6 items-center justify-center rounded-md text-xs font-bold sm:text-sm ${
                    today ? "bg-accent-500 text-ink-950" : holidayName || isSunday ? "text-red-300" : "text-ink-200"
                  }`}>{formatKoreanDate(day, "d")}</span>
                  <div className="pointer-events-auto flex shrink-0 items-center gap-0.5">
                    {events.length > 0 ? <span className="hidden truncate text-[10px] text-ink-400 sm:inline">{activeCount ? `${activeCount} 남음` : `${events.length} 완료`}</span> : null}
                    <button type="button" className="inline-flex h-7 w-7 items-center justify-center rounded-md text-ink-500 hover:bg-ink-800 hover:text-ink-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500" onClick={() => onQuickAdd(dateKey)} aria-label={`${formattedDate} Todo 추가`} title="이 날짜에 Todo 추가">
                      <Plus size={14} />
                    </button>
                  </div>
                </div>
                {holidayName ? <span className="mt-0.5 truncate text-[10px] text-red-300/85" title={holidayName}>{holidayName}</span> : null}
                <div className="mt-1 min-w-0 space-y-1">
                  {events.slice(0, 3).map((event, index) => (
                    <CalendarEventChip
                      key={event.id}
                      event={event}
                      draggingDisabled={draggingDisabled}
                      onClick={() => event.relatedTodoId ? onOpenTodo(event.relatedTodoId) : onSelectDate(dateKey)}
                      hiddenClass={index === 1 ? "hidden sm:block" : index === 2 ? "hidden lg:block" : ""}
                    />
                  ))}
                  {events.length > 1 ? (
                    <button type="button" onClick={() => onSelectDate(dateKey)} className="pointer-events-auto block max-w-full truncate text-left text-[10px] font-medium text-ink-400 hover:text-ink-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent-500 sm:hidden">
                      +{events.length - 1}개 더보기
                    </button>
                  ) : null}
                  {events.length > 2 ? (
                    <button type="button" onClick={() => onSelectDate(dateKey)} className="pointer-events-auto hidden max-w-full truncate text-left text-[10px] font-medium text-ink-400 hover:text-ink-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent-500 sm:block lg:hidden">
                      +{events.length - 2}개 더보기
                    </button>
                  ) : null}
                  {events.length > 3 ? (
                    <button type="button" onClick={() => onSelectDate(dateKey)} className="pointer-events-auto hidden max-w-full truncate text-left text-[10px] font-medium text-ink-400 hover:text-ink-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent-500 lg:block">
                      +{events.length - 3}개 더보기
                    </button>
                  ) : null}
                </div>
                <div className="mt-auto flex items-center justify-between gap-1 pt-1">
                  <span className="hidden truncate text-[10px] text-ink-500 sm:block">{dayGoals.length ? `목표 ${dayGoals.length}` : ""}</span>
                  <button type="button" onClick={() => onCycleDayStatus(dateKey)} aria-label={statusActionLabel} title="일일 수행 상태 O → X → 미설정"
                    className={`pointer-events-auto ml-auto inline-flex min-h-6 min-w-6 items-center justify-center rounded border px-1 text-[10px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 ${
                      dayStatus === "O" ? "border-success/35 text-emerald-200" : dayStatus === "X" ? "border-danger/35 text-red-200" : "border-transparent text-ink-600 hover:border-ink-700 hover:text-ink-300"
                    }`}>
                    {dayStatus ?? "–"}
                  </button>
                </div>
              </div>
            </article>
            </CalendarDropCell>
          );
        })}
      </div>
      <p className="mt-3 text-xs text-ink-400">Todo를 끌어 다른 날짜로 이동하거나 제목을 선택해 수정하세요. 모바일에서는 상세 화면에서 날짜를 변경할 수 있습니다.</p>
    </section>
  );
}
