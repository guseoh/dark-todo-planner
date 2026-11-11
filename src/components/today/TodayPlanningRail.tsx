import { differenceInCalendarDays } from "date-fns";
import { useEffect, useState, type ComponentProps } from "react";
import { api, jsonBody } from "../../lib/api/client";
import { getWeekDays, getWeekRange, parseDateKey, toDateKey, todayKey, weekdayLabels } from "../../lib/date";
import type { Todo } from "../../types/todo";
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

  useEffect(() => {
    const media = window.matchMedia("(min-width: 1280px)");
    let live = true;
    const load = () => {
      if (!media.matches) return;
      void api<{ routines: Routine[] }>("/api/routines")
        .then((result) => { if (live) setRoutines(result.routines); })
        .catch(() => { if (live) setError("루틴 목록을 불러오지 못했습니다."); });
    };
    load();
    media.addEventListener("change", load);
    return () => { live = false; media.removeEventListener("change", load); };
  }, []);

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

  const dueSoon = todos.filter((todo) => !todo.completed && !todo.archived && todo.dueDate)
    .map((todo) => ({ todo, days: differenceInCalendarDays(parseDateKey(todo.dueDate!), parseDateKey(today)) }))
    .filter(({ days }) => days >= 0 && days <= dueSoonDays)
    .sort((a, b) => a.days - b.days);

  return (
    <aside className="today-desktop-rail" aria-label="오늘 계획">
      <section aria-label="이번 주">
        <h2>이번 주</h2>
        <div className="grid grid-cols-7 gap-0.5 text-center text-xs">
          {getWeekDays(parseDateKey(today)).map((day, index) => {
            const date = toDateKey(day);
            const count = todos.filter((todo) => todo.date === date && !todo.completed && !todo.archived).length;
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
      <GoalChecklist title="주간 목표" type="WEEKLY" addDefaults={{ weekStartDate: start, weekEndDate: end, dueDate: end }}
        goals={goals.filter((goal) => goal.type === "WEEKLY" && (!goal.weekStartDate || goal.weekStartDate <= end) && (!goal.weekEndDate || goal.weekEndDate >= start))}
        placeholder="주간 목표 추가" emptyTitle="주간 목표가 없습니다." onAdd={onAddGoal}
        onUpdate={onUpdateGoal} onToggle={onToggleGoal} onDelete={onDeleteGoal} />
      <section aria-label="곧 마감">
        <h2>곧 마감</h2>
        <ul className="space-y-1">
          {dueSoon.map(({ todo, days }) => <li key={todo.id} className="flex gap-2 text-xs">
            <span className="min-w-0 flex-1 truncate" title={todo.title}>{todo.title}</span>
            <span className={days <= 1 ? "text-warning" : "text-ui-muted"}>{days === 0 ? "D-Day" : `D-${days}`}</span>
          </li>)}
        </ul>
        {!dueSoon.length ? <p className="text-xs text-ui-muted">임박한 마감이 없습니다.</p> : null}
      </section>
      <section aria-label="루틴 묶음">
        <h2>루틴 묶음</h2>
        <ul className="space-y-1">
          {routines.map((routine) => <li key={routine.id} className="flex items-center gap-2">
            <span className="min-w-0 flex-1 truncate text-xs" title={routine.name}>{routine.name}</span>
            <button type="button" className="btn-secondary shrink-0 text-xs" disabled={Boolean(running) || routine.lastRunDate === today}
              onClick={() => void runRoutine(routine)}>{routine.lastRunDate === today ? "완료" : "불러오기"}</button>
          </li>)}
        </ul>
        {!routines.length && !error ? <p className="text-xs text-ui-muted">저장된 루틴이 없습니다.</p> : null}
        {error ? <p role="alert" className="text-xs text-danger">{error}</p> : null}
      </section>
    </aside>
  );
}
