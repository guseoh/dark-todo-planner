import { useEffect, useMemo, useState } from "react";
import { CalendarCheck2, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Plus } from "lucide-react";
import { addWeeks } from "date-fns";
import { calculateRate, formatCompletionRate } from "../../lib/todo";
import { formatKoreanDate, getWeekDays, parseDateKey, toDateKey, todayKey } from "../../lib/date";
import type { Todo, TodoInput } from "../../types/todo";
import type { Category } from "../../types/category";
import type { Goal } from "../../types/goal";
import { GoalChecklist } from "../goal/GoalChecklist";
import { InlineTodoAdd } from "../todo/InlineTodoAdd";
import { TodoEditModal } from "../todo/TodoEditModal";
import { TodoRow } from "../todo/TodoRow";

type WeeklyViewProps = {
  getTodosByDate: (date: string) => Todo[];
  onAdd: (todo: TodoInput) => Promise<Todo | undefined> | Todo | undefined;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onUpdate: (id: string, updates: Partial<Omit<Todo, "id" | "createdAt">>) => void;
  onAddGoal: (input: Partial<Goal> & { title: string }) => Promise<Goal | undefined>;
  onUpdateGoal: (id: string, updates: Partial<Omit<Goal, "id" | "createdAt">>) => Promise<Goal | undefined>;
  onToggleGoal: (id: string) => Promise<boolean>;
  onDeleteGoal: (id: string) => Promise<boolean>;
  categories?: Category[];
  goals?: Goal[];
};

const dayLabelTone = (index: number) => {
  if (index === 5) return "text-sky-400/65";
  if (index === 6) return "text-red-400/65";
  return "text-ink-300";
};

export function WeeklyView({
  getTodosByDate,
  onAdd,
  onToggle,
  onDelete,
  onUpdate,
  onAddGoal,
  onUpdateGoal,
  onToggleGoal,
  onDeleteGoal,
  categories = [],
  goals = [],
}: WeeklyViewProps) {
  // The 03:00 planner-day rollover triggers a rerender in App; derive visible
  // dates from the current planner day rather than freezing them at mount.
  const today = todayKey();
  const [weekOffset, setWeekOffset] = useState(0);
  const weekDays = useMemo(
    () => getWeekDays(addWeeks(parseDateKey(today), weekOffset)),
    [today, weekOffset],
  );
  const weekDateKeys = useMemo(() => weekDays.map(toDateKey), [weekDays]);
  const weekStart = weekDateKeys[0];
  const weekEnd = weekDateKeys[6];
  const [selectedDate, setSelectedDate] = useState(today);
  const weekTodos = useMemo(() => weekDateKeys.flatMap((date) => getTodosByDate(date)), [weekDateKeys, getTodosByDate]);

  const moveWeek = (delta: number) => {
    const offset = weekOffset + delta;
    const dates = getWeekDays(addWeeks(parseDateKey(today), offset));
    setWeekOffset(offset);
    setSelectedDate(offset === 0 ? today : toDateKey(dates[0]));
  };
  const backToThisWeek = () => {
    setWeekOffset(0);
    setSelectedDate(today);
  };
  const [addingDate, setAddingDate] = useState<string | null>(null);
  const [editingTodo, setEditingTodo] = useState<Todo | null>(null);
  const [showCompleted, setShowCompleted] = useState(false);

  const weekRate = calculateRate(weekTodos);
  const weekActiveCount = weekTodos.filter((todo) => !todo.completed).length;
  const weeklyGoals = goals.filter(
    (goal) =>
      goal.type === "WEEKLY" &&
      (!goal.weekStartDate || goal.weekStartDate <= weekEnd) &&
      (!goal.weekEndDate || goal.weekEndDate >= weekStart),
  );
  const completedWeeklyGoals = weeklyGoals.filter((goal) => goal.completed).length;
  const selectedTodos = getTodosByDate(selectedDate);
  const selectedActiveTodos = selectedTodos.filter((todo) => !todo.completed);
  const selectedCompletedTodos = selectedTodos.filter((todo) => todo.completed);

  const daySummaries = weekDays.map((day, index) => {
    const date = toDateKey(day);
    const dayTodos = getTodosByDate(date);
    const active = dayTodos.filter((todo) => !todo.completed).length;
    return {
      date,
      day,
      index,
      total: dayTodos.length,
      active,
      completed: dayTodos.length - active,
      high: dayTodos.filter((todo) => !todo.completed && todo.priority === "HIGH").length,
    };
  });

  useEffect(() => {
    if (!weekDateKeys.includes(selectedDate)) setSelectedDate(weekOffset === 0 ? today : weekStart);
  }, [selectedDate, today, weekDateKeys, weekOffset, weekStart]);

  useEffect(() => {
    setAddingDate(null);
    setShowCompleted(false);
  }, [selectedDate]);

  return (
    <div className="space-y-4">
      <section className="app-card px-3.5 py-3" aria-labelledby="week-summary-title">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <div>
              <p className="text-xs font-semibold text-ink-400">{weekOffset === 0 ? "이번 주" : "선택한 주"}</p>
              <h3 id="week-summary-title" className="mt-0.5 text-base font-bold text-ink-100">
                {formatKoreanDate(weekStart, "M.d")} ~ {formatKoreanDate(weekEnd, "M.d")}
              </h3>
            </div>
            <div className="flex items-center gap-1" aria-label="주간 이동">
              <button type="button" className="icon-btn min-h-9 min-w-9" onClick={() => moveWeek(-1)} aria-label="이전 주" title="이전 주"><ChevronLeft size={17} /></button>
              <button type="button" className="icon-btn min-h-9 min-w-9" onClick={() => moveWeek(1)} aria-label="다음 주" title="다음 주"><ChevronRight size={17} /></button>
              {weekOffset !== 0 ? <button type="button" className="btn-secondary min-h-9 px-2 text-xs" onClick={backToThisWeek}>이번 주</button> : null}
            </div>
          </div>
          <dl className="flex flex-wrap gap-x-5 gap-y-1.5 text-xs">
            <div className="flex items-center gap-1.5"><dt className="text-ink-500">Todo</dt><dd className="font-bold text-ink-100">{weekTodos.length}</dd></div>
            <div className="flex items-center gap-1.5"><dt className="text-ink-500">미완료</dt><dd className="font-bold text-ink-100">{weekActiveCount}</dd></div>
            <div className="flex items-center gap-1.5"><dt className="text-ink-500">완료율</dt><dd className="font-bold text-accent-300">{formatCompletionRate(weekTodos.length, weekRate)}</dd></div>
            <div className="flex items-center gap-1.5"><dt className="text-ink-500">주간 목표</dt><dd className="font-bold text-ink-300">{completedWeeklyGoals}/{weeklyGoals.length}</dd></div>
          </dl>
        </div>
      </section>

      <div className="w-full">
        <GoalChecklist
          title={weekOffset === 0 ? "이번 주 목표" : "선택한 주 목표"}
          goals={weeklyGoals}
          type="WEEKLY"
          addDefaults={{ weekStartDate: weekStart, weekEndDate: weekEnd, dueDate: weekEnd }}
          placeholder="이번 주에 끝낼 핵심 목표"
          emptyTitle="이번 주 목표가 없습니다."
          onAdd={onAddGoal}
          onUpdate={onUpdateGoal}
          onToggle={onToggleGoal}
          onDelete={onDeleteGoal}
        />
      </div>

      <section className="space-y-3" aria-labelledby="week-days-title">
        <div className="flex items-end justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <CalendarCheck2 size={17} className="text-accent-300" />
              <h3 id="week-days-title" className="text-sm font-bold text-ink-100">7일 흐름</h3>
            </div>
            <p className="mt-1 text-[11px] text-ink-500">요일은 분포만 보고, Todo 내용은 선택한 날짜에서 확인합니다.</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
          {daySummaries.map(({ date, day, index, active, completed, high }) => {
            const selected = date === selectedDate;
            const isToday = date === today;
            return (
              <button
                key={date}
                type="button"
                className={`min-w-0 rounded-md border px-2.5 py-2 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/40 ${
                  selected
                    ? "border-accent-500/50 bg-accent-500/[0.08] ring-1 ring-accent-500/15"
                    : "border-ink-700/65 bg-ink-900/45 hover:border-ink-500 hover:bg-ink-800/65"
                }`}
                onClick={() => setSelectedDate(date)}
                aria-pressed={selected}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className={`text-xs font-bold ${selected ? "text-ink-100" : dayLabelTone(index)}`}>{formatKoreanDate(day, "E요일")}</span>
                  {isToday ? <span className="rounded-full border border-accent-500/35 bg-accent-500/10 px-1.5 py-0.5 text-[9px] font-bold text-accent-200">오늘</span> : null}
                </div>
                <p className="mt-0.5 text-[11px] text-ink-500">{formatKoreanDate(day, "M월 d일")}</p>
                <div className="mt-2 flex flex-wrap gap-x-2 gap-y-0.5 text-[10px]">
                  <span className={active ? "font-bold text-amber-100" : "text-ink-600"}>미완료 {active}</span>
                  <span className="text-ink-500">완료 {completed}</span>
                  {high ? <span className="font-bold text-red-100">높은 우선순위 {high}</span> : null}
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <section className="app-card p-3.5" aria-labelledby="selected-day-title">
        <div className="flex flex-col gap-3 border-b border-ink-700/55 pb-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 id="selected-day-title" className="text-base font-bold text-ink-100">{formatKoreanDate(selectedDate, "M월 d일 EEEE")}</h3>
            <p className="mt-0.5 text-xs text-ink-500">미완료 {selectedActiveTodos.length}개 · 완료 {selectedCompletedTodos.length}개</p>
          </div>
          <button
            type="button"
            className={addingDate === selectedDate ? "btn-secondary" : "btn-primary"}
            onClick={() => setAddingDate((current) => current === selectedDate ? null : selectedDate)}
          >
            <Plus size={15} />{addingDate === selectedDate ? "추가 닫기" : `${formatKoreanDate(selectedDate, "M월 d일")} Todo 추가`}
          </button>
        </div>

        {addingDate === selectedDate ? (
          <div className="mt-3">
            <InlineTodoAdd
              defaultDate={selectedDate}
              layout="inline"
              placeholder="선택한 날짜에 Todo 추가"
              onAdd={onAdd}
              onCancel={() => setAddingDate(null)}
            />
          </div>
        ) : null}

        <div className="mt-3 space-y-1.5">
          {selectedActiveTodos.length ? (
            selectedActiveTodos.map((todo) => (
              <TodoRow
                key={todo.id}
                todo={todo}
                onToggle={onToggle}
                onDelete={onDelete}
                onEdit={setEditingTodo}
                showDate={false}
                showCategoryBadge={false}
                showCategoryMeta
                hideMediumPriority
              />
            ))
          ) : (
            <div className="rounded-md border border-dashed border-ink-700/60 px-3 py-4 text-center">
              <p className="text-sm font-semibold text-ink-400">미완료 Todo가 없습니다.</p>
              <p className="mt-1 text-[11px] text-ink-600">다른 날짜를 선택하거나 새 Todo를 추가할 수 있습니다.</p>
            </div>
          )}
        </div>

        {selectedCompletedTodos.length ? (
          <div className="mt-3 border-t border-ink-700/50 pt-2.5">
            <button
              type="button"
              className="flex min-h-9 w-full items-center justify-between rounded-md px-2 text-left text-xs font-semibold text-ink-400 transition hover:bg-ink-900/70 hover:text-ink-200"
              onClick={() => setShowCompleted((value) => !value)}
              aria-expanded={showCompleted}
            >
              <span>완료 {selectedCompletedTodos.length}개</span>
              {showCompleted ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
            {showCompleted ? (
              <div className="mt-1.5 space-y-1.5">
                {selectedCompletedTodos.map((todo) => (
                  <TodoRow
                    key={todo.id}
                    todo={todo}
                    onToggle={onToggle}
                    onDelete={onDelete}
                    onEdit={setEditingTodo}
                    showDate={false}
                    showCategoryBadge={false}
                    showCategoryMeta
                    hideMediumPriority
                  />
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </section>

      <TodoEditModal
        todo={editingTodo}
        categories={categories}
        onClose={() => setEditingTodo(null)}
        onSave={onUpdate}
      />
    </div>
  );
}
