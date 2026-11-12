import { getEntityColor } from "./entityColor";
import type { Category } from "../types/category";
import type { Milestone, Project } from "../types/project";
import type { Todo } from "../types/todo";

export type CalendarEventKind = "todo" | "deadline" | "milestone" | "project";
export type CalendarEvent = {
  id: string;
  date: string;
  kind: CalendarEventKind;
  title: string;
  completed: boolean;
  relatedTodoId?: string;
  dueOnDate?: boolean;
  projectName?: string;
  color?: string;
  startDate?: string;
};
export type CalendarVisibility = {
  todo: boolean;
  deadline: boolean;
  project: boolean;
};

export const defaultCalendarVisibility: CalendarVisibility = {
  todo: true,
  deadline: true,
  project: true,
};

const isDateKey = (value: string | undefined): value is string =>
  Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value) && !value.startsWith("9999-"));

const kindRank: Record<CalendarEventKind, number> = {
  todo: 0,
  deadline: 1,
  milestone: 2,
  project: 3,
};

// Only actual scheduled dates are actionable Todo occurrences; due dates are
// separate markers and never count as another scheduled Todo on the same date.
export const buildCalendarEvents = (
  todos: Todo[],
  projects: Project[],
  milestones: Milestone[],
  categories: Category[] = [],
): CalendarEvent[] => {
  const result: CalendarEvent[] = [];
  const visibleProjects = new Map(projects.filter((project) => !project.archived).map((project) => [project.id, project]));
  for (const todo of todos) {
    if (todo.archived) continue;
    const project = visibleProjects.get(todo.projectId ?? "");
    const category = categories.find(({ id }) => id === todo.categoryId);
    const color = project ? getEntityColor(project, projects) : getEntityColor(category, categories);
    if ((!todo.planningState || todo.planningState === "SCHEDULED") && isDateKey(todo.date)) {
      result.push({
        id: `todo:${todo.id}`,
        date: todo.date,
        kind: "todo",
        title: todo.title,
        completed: todo.completed,
        relatedTodoId: todo.id,
        color,
        dueOnDate: todo.dueDate === todo.date,
      });
    }
    if (isDateKey(todo.dueDate) && todo.dueDate !== todo.date) {
      result.push({
        id: `deadline:${todo.id}`,
        date: todo.dueDate,
        kind: "deadline",
        title: todo.title,
        completed: todo.completed,
        relatedTodoId: todo.id,
        color,
      });
    }
  }
  for (const project of visibleProjects.values()) {
    if (isDateKey(project.targetDate)) {
      result.push({
        id: `project:${project.id}`,
        date: project.targetDate,
        kind: "project",
        title: project.name,
        completed: project.status === "DONE",
        projectName: project.name,
        color: getEntityColor(project, projects),
        startDate: isDateKey(project.startDate) && project.startDate < project.targetDate ? project.startDate : undefined,
      });
    }
  }
  for (const milestone of milestones) {
    const project = visibleProjects.get(milestone.projectId);
    if (!project || !isDateKey(milestone.targetDate)) continue;
    result.push({
      id: `milestone:${milestone.id}`,
      date: milestone.targetDate,
      kind: "milestone",
      title: milestone.title,
      completed: milestone.status === "DONE",
      projectName: project.name,
      color: getEntityColor(project, projects),
    });
  }
  return result.sort((a, b) =>
    a.date.localeCompare(b.date)
    || Number(a.completed) - Number(b.completed)
    || kindRank[a.kind] - kindRank[b.kind]
    || a.title.localeCompare(b.title, "ko")
    || a.id.localeCompare(b.id));
};

export const isCalendarEventVisible = (event: CalendarEvent, visibility: CalendarVisibility) =>
  event.kind === "todo" ? visibility.todo
    : event.kind === "deadline" ? visibility.deadline
      : visibility.project;

export const groupCalendarEvents = (events: CalendarEvent[], visibility: CalendarVisibility) => {
  const byDate = new Map<string, CalendarEvent[]>();
  for (const event of events) {
    if (!isCalendarEventVisible(event, visibility)) continue;
    const dayEvents = byDate.get(event.date) ?? [];
    dayEvents.push(event);
    byDate.set(event.date, dayEvents);
  }
  return byDate;
};


export function placeCalendarSpans(events: CalendarEvent[], dates: string[]) {
  if (!dates.length) return [];
  const weekStart = dates[0];
  const weekEnd = dates[dates.length - 1];
  const rows: number[] = [];
  return events.filter((event) => event.startDate && event.startDate <= weekEnd && event.date >= weekStart)
    .map((event) => ({
      event,
      first: dates.findIndex((date) => date >= event.startDate!),
      last: dates.filter((date) => date <= event.date).length - 1,
    }))
    .sort((a, b) => a.first - b.first || b.last - a.last)
    .map(({ event, first, last }) => {
      const available = rows.findIndex((end) => end < first);
      const row = available < 0 ? rows.length : available;
      rows[row] = last;
      return { event, first, last, row };
    });
}
