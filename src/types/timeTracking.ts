/** The one running timer. Finished work becomes a TimeEntry when the timer stops. */
export type ActiveTimer = {
  todoId?: string;
  todoTitle: string;
  categoryId?: string;
  categoryName?: string;
  projectId?: string;
  startedAt: string;
};

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
