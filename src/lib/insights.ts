import { eachDayOfInterval } from "date-fns";
import { parseDateKey, toDateKey } from "./date";
import type { Project } from "../types/project";
import type { FocusSession, TimeBlock } from "../types/time";
import type { Todo } from "../types/todo";

const UNSCHEDULED_DATE = "9999-12-31";
const inRange = (date: string, from: string, to: string) => date >= from && date <= to;
const rate = (completed: number, total: number) => total ? Math.round((completed / total) * 100) : 0;
const sumMinutes = (values: Array<number | undefined>) => values.reduce<number>((sum, value) => sum + (value || 0), 0);

export type DailyInsight = {
  date: string;
  total: number;
  completed: number;
  completionRate: number;
  focusMinutes: number;
};

export type ProjectInsight = {
  id: string;
  name: string;
  color?: string;
  status: Project["status"];
  total: number;
  completed: number;
  completionRate: number;
  overdue: number;
  remainingEstimateMinutes: number;
};

type BuildInsightsInput = {
  todos: Todo[];
  projects: Project[];
  focusSessions: FocusSession[];
  timeBlocks: TimeBlock[];
  from: string;
  to: string;
  today: string;
};

export function buildInsightsSnapshot({ todos, projects, focusSessions, timeBlocks, from, to, today }: BuildInsightsInput) {
  const scheduledTodos = todos.filter((todo) => todo.planningState === "SCHEDULED" && todo.date !== UNSCHEDULED_DATE);
  const periodTodos = scheduledTodos.filter((todo) => inRange(todo.date, from, to));
  const completedPeriodTodos = periodTodos.filter((todo) => todo.completed);
  const overdueTodos = scheduledTodos.filter((todo) => !todo.archived && !todo.completed && todo.date < today);
  const estimatedTodos = periodTodos.filter((todo) => Boolean(todo.estimateMinutes));

  const periodFocusSessions = focusSessions.filter((session) => session.mode === "FOCUS" && session.completed && inRange(session.plannerDate, from, to));
  const periodTimeBlocks = timeBlocks.filter((block) => inRange(block.date, from, to));
  const focusMinutes = sumMinutes(periodFocusSessions.map((session) => session.durationMinutes));
  const plannedMinutes = sumMinutes(periodTimeBlocks.map((block) => block.plannedMinutes));

  const daily = eachDayOfInterval({ start: parseDateKey(from), end: parseDateKey(to) }).map((date): DailyInsight => {
    const dateKey = toDateKey(date);
    const dayTodos = periodTodos.filter((todo) => todo.date === dateKey);
    const completed = dayTodos.filter((todo) => todo.completed).length;
    return {
      date: dateKey,
      total: dayTodos.length,
      completed,
      completionRate: rate(completed, dayTodos.length),
      focusMinutes: sumMinutes(periodFocusSessions.filter((session) => session.plannerDate === dateKey).map((session) => session.durationMinutes)),
    };
  });

  const projectInsights = projects
    .filter((project) => !project.archived)
    .map((project): ProjectInsight => {
      const projectTodos = todos.filter((todo) => todo.projectId === project.id);
      const completed = projectTodos.filter((todo) => todo.completed).length;
      const overdue = projectTodos.filter((todo) => !todo.archived && !todo.completed && todo.planningState === "SCHEDULED" && todo.date !== UNSCHEDULED_DATE && todo.date < today).length;
      return {
        id: project.id,
        name: project.name,
        color: project.color,
        status: project.status,
        total: projectTodos.length,
        completed,
        completionRate: rate(completed, projectTodos.length),
        overdue,
        remainingEstimateMinutes: sumMinutes(projectTodos.filter((todo) => !todo.completed).map((todo) => todo.estimateMinutes)),
      };
    })
    .sort((a, b) => Number(b.status === "ACTIVE") - Number(a.status === "ACTIVE") || b.total - a.total || a.name.localeCompare(b.name, "ko"));

  return {
    periodTodoTotal: periodTodos.length,
    periodTodoCompleted: completedPeriodTodos.length,
    completionRate: rate(completedPeriodTodos.length, periodTodos.length),
    overdueTotal: overdueTodos.length,
    estimatedMinutes: sumMinutes(estimatedTodos.map((todo) => todo.estimateMinutes)),
    estimatedTodoCount: estimatedTodos.length,
    focusMinutes,
    focusSessionCount: periodFocusSessions.length,
    plannedMinutes,
    timeBlockCount: periodTimeBlocks.length,
    completedTimeBlockCount: periodTimeBlocks.filter((block) => block.completed).length,
    focusVsPlanRate: plannedMinutes ? Math.round((focusMinutes / plannedMinutes) * 100) : undefined,
    daily,
    projects: projectInsights,
  };
}

export function formatInsightMinutes(minutes: number) {
  const normalized = Math.max(0, Math.round(minutes));
  if (normalized < 60) return `${normalized}분`;
  const hours = Math.floor(normalized / 60);
  const remainder = normalized % 60;
  return remainder ? `${hours}시간 ${remainder}분` : `${hours}시간`;
}
