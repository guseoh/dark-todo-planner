import { differenceInCalendarDays } from "date-fns";
import { useEffect, useMemo, useState, type ComponentProps } from "react";
import { api, jsonBody } from "../../lib/api/client";
import { ChevronDown } from "lucide-react";
import { getWeekDays, getWeekRange, parseDateKey, toDateKey, todayKey, weekdayLabels } from "../../lib/date";
import type { Todo } from "../../types/todo";
import { GithubGrassCard } from "../activity/GithubGrassCard";
import { TodayTimeCard } from "../timer/TodayTimeCard";
import { GoalChecklist } from "../goal/GoalChecklist";
import type { Routine } from "../settings/RoutinePanel";

type GoalProps = Pick<ComponentProps<typeof GoalChecklist>, "goals" | "onAdd" | "onUpdate" | "onToggle" | "onDelete">;
type Props = {
  todos: Todo[];
  goals: GoalProps["goals"];
  dueSoonDays: number;
  onAddGoal: GoalProps["onAdd"];
  onUpdateGoal: GoalProps["onUpdate"];
  onToggleGoal: GoalProps["onToggle"];
  onDeleteGoal: GoalProps["onDelete"];
  onReload: () => Promise<unknown>;
};

export function TodayPlanningRail({ todos, goals, dueSoonDays, onAddGoal, onUpdateGoal, onToggleGoal, onDeleteGoal, onReload }: Props) {
  const today = todayKey();
  const { start, end } = getWeekRange(parseDateKey(today));
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [running, setRunning] = useState("");
  const [error, setError] = useState("");
  const [extrasOpen, setExtrasOpen] = useState(false);

  useEffect(() => {
    if (!extrasOpen) return;
    let live = true;
    setError("");
    void api<{ routines: Routine[] }>("/api/routines")
      .then((result) => { if (live) setRoutines(result.routines); })
      .catch(() => { if (live) setError("루틴 목록을 불러오지 못했습니다."); });
    return () => { live = false; };
  }, [extrasOpen]);

  const runRoutine = async (routine: Routine) => {
    if (running || routine.lastRunDate === today) return;
    setRunning(routine.id);
    setError("");
    try {
      await api(`/api/routines/${routine.id}/run`, { method: "POST", ...jsonBody({ targetDate: today }) });
      setRoutines((current) => current.map((item) => item.id === routine.id ? { ...item, lastRunDate: today } : item));
      await onReload();
    } catch {
      setError("루틴 실행 결과를 불러오지 못했습니다.");
    } finally {
      setRunning("");
    }
  };

  const deadlines = useMemo(() => todos
    .filter((todo) => !todo.completed && !todo.archived && todo.dueDate)
    .map((todo) => ({ todo, days: differenceInCalendarDays(parseDateKey(todo.dueDate!), parseDateKey(today)) }))
    .sort((a, b) => a.days - b.days), [todos, today]);
  const missedDeadlines = deadlines.filter(({ days }) => days < 0);
  const dueSoon = deadlines.filter(({ days }) => days >= 0 && days <= dueSoonDays);
  const weekCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const todo of todos) {
      if (todo.completed || todo.archived || todo.planningState !== "SCHEDULED") continue;
      counts.set(todo.date, (counts.get(todo.date) ?? 0) + 1);
    }
    return counts;
  }, [todos]);

  return (
    <aside className="today-desktop-rail" aria-label="오늘 계획">
      <section aria-label="이번 주">
        <h2>이번 주</h2>
        <div className="grid grid-cols-7 gap-0.5 text-center text-xs">
          {getWeekDays(parseDateKey(today)).map((day, index) => {
            const date = toDateKey(day);
            const count = weekCounts.get(date) ?? 0;
            return (
              <a key={date} href={`#/calendar/week?date=${date}`}
                className={`rounded-md py-1 ${date === today ? "today-week-current" : index === 5 ? "text-accent-300" : index === 6 ? "text-danger" : ""}`}
                aria-label={`${date}, 미완료 ${count}개`} aria-current={date === today ? "date" : undefined}>
                <span className="block">{weekdayLabels[index]}</span>
                <span className="block">{day.getDate()}</span>
                <span className="block min-h-3" aria-hidden="true">{count > 0 ? "•".repeat(Math.min(3, count)) : ""}</span>
              </a>
            );
          })}
        </div>
      </section>
      <TodayTimeCard />
      <GoalChecklist title="주간 목표" type="WEEKLY" addDefaults={{ weekStartDate: start, weekEndDate: end, dueDate: end }}
        goals={goals.filter((goal) => goal.type === "WEEKLY" && (!goal.weekStartDate || goal.weekStartDate <= end) && (!goal.weekEndDate || goal.weekEndDate >= start))}
        placeholder="주간 목표 추가" emptyTitle="이번 주 목표가 아직 없습니다." layout="stacked" onAdd={onAddGoal}
        onUpdate={onUpdateGoal} onToggle={onToggleGoal} onDelete={onDeleteGoal} />
      {missedDeadlines.length ? (
        <section aria-label="마감일이 지난 작업" className="today-rail-deadline-warning">
          <h2>지난 마감 <span className="text-danger">{missedDeadlines.length}개</span></h2>
          <ul className="space-y-1">
            {missedDeadlines.slice(0, 4).map(({ todo, days }) => (
              <li key={todo.id} className="flex gap-2 text-xs">
                <span className="min-w-0 flex-1 truncate" title={todo.title}>{todo.title}</span>
                <span className="shrink-0 text-danger">{Math.abs(days)}일 지남</span>
              </li>
            ))}
          </ul>
          {missedDeadlines.length > 4 ? <a href="#/all" className="text-xs text-ui-secondary underline">전체 작업에서 더 보기</a> : null}
        </section>
      ) : null}
      {dueSoon.length ? (
        <section aria-label="곧 마감">
          <h2>곧 마감</h2>
          <ul className="space-y-1">
            {dueSoon.slice(0, 4).map(({ todo, days }) => <li key={todo.id} className="flex gap-2 text-xs">
              <span className="min-w-0 flex-1 truncate" title={todo.title}>{todo.title}</span>
              <span className={days <= 1 ? "text-warning" : "text-ui-muted"}>{days === 0 ? "D-Day" : `D-${days}`}</span>
            </li>)}
          </ul>
        </section>
      ) : null}
      <details className="today-rail-extras" open={extrasOpen} onToggle={(event) => setExtrasOpen(event.currentTarget.open)}>
        <summary className="today-rail-extras__toggle">
          <span>루틴 · GitHub 활동</span>
          <ChevronDown size={15} aria-hidden="true" />
        </summary>
        {extrasOpen ? <div className="today-rail-extras__content">
      <section aria-label="루틴 묶음">
        <h2>루틴 묶음</h2>
        <ul className="space-y-1">
          {routines.map((routine) => <li key={routine.id} className="flex items-center gap-2">
            <span className="min-w-0 flex-1 truncate text-xs" title={routine.name}>{routine.name}</span>
            <button type="button" className="btn-secondary shrink-0 text-xs" disabled={Boolean(running) || routine.lastRunDate === today}
              onClick={() => void runRoutine(routine)}>{routine.lastRunDate === today ? "완료" : "불러오기"}</button>
          </li>)}
        </ul>
        {!routines.length && !error ? (
          <p className="text-xs text-ui-muted">
            저장된 루틴이 없습니다. <a className="underline underline-offset-2 hover:text-ui-text" href="#/settings">설정에서 만들기</a>
          </p>
        ) : null}
        {error ? <p role="alert" className="text-xs text-danger">{error}</p> : null}
      </section>
      <GithubGrassCard />
        </div> : null}
      </details>
    </aside>
  );
}
