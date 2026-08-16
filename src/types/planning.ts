import type { TodoInput, TodoPlanningState, TodoPriority, TodoWorkflowStatus } from "./todo";

export type SavedViewDueMode = "ANY" | "OVERDUE" | "DUE_SOON" | "NO_DUE";

export type SavedViewQuery = {
  planningState?: "ALL" | TodoPlanningState;
  workflowStatus?: "ALL" | TodoWorkflowStatus;
  priority?: "ALL" | TodoPriority;
  projectId?: "ALL" | "NO_PROJECT" | string;
  dueMode?: SavedViewDueMode;
};

export type DailyPlan = {
  id: string;
  userId?: string;
  date: string;
  focusText?: string;
  topTodoIds: string[];
  createdAt: string;
  updatedAt: string;
};

export type DailyPlanInput = {
  focusText?: string;
  topTodoIds: string[];
};

export type WeeklyReview = {
  id: string;
  userId?: string;
  weekStartDate: string;
  wins?: string;
  blockers?: string;
  lessons?: string;
  nextFocus?: string;
  createdAt: string;
  updatedAt: string;
};

export type WeeklyReviewInput = {
  wins?: string;
  blockers?: string;
  lessons?: string;
  nextFocus?: string;
};

export type SavedView = {
  id: string;
  userId?: string;
  name: string;
  query: SavedViewQuery;
  createdAt: string;
  updatedAt: string;
};

export type SavedViewInput = {
  name: string;
  query: SavedViewQuery;
};

export type TaskTemplate = {
  id: string;
  userId?: string;
  name: string;
  todo: TodoInput;
  createdAt: string;
  updatedAt: string;
};

export type TaskTemplateInput = {
  name: string;
  todo: TodoInput;
};
