/** The one running timer. Finished work becomes a TimeEntry when the timer stops. */
export type ActiveTimer = {
  todoId?: string;
  todoTitle: string;
  categoryId?: string;
  categoryName?: string;
  projectId?: string;
  startedAt: string;
};

/** What a timer can run on: one Todo, a whole category, or a project (optionally tagged with a category). */
export type TimerTarget =
  | { todoId: string }
  | { categoryId: string }
  | { projectId: string; categoryId?: string };

/** A finished, measured work interval. Every entry belongs to exactly one planner day. */
export type TimeEntry = {
  id: string;
  todoId?: string;
  title: string;
  categoryId?: string;
  categoryName?: string;
  projectId?: string;
  plannerDate: string;
  startedAt: string;
  endedAt: string;
  durationMinutes: number;
};

export type TimeEntryInput = {
  todoId?: string | null;
  title?: string;
  categoryId?: string | null;
  startedAt: string;
  endedAt: string;
};
