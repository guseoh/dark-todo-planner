import type { Category } from "./category";

export type TodoPriority = "LOW" | "MEDIUM" | "HIGH";
export type TodoRepeat = "NONE" | "DAILY" | "WEEKLY" | "MONTHLY" | "WEEKDAY" | "WEEKEND";
export type TodoPlanningState = "INBOX" | "SCHEDULED" | "SOMEDAY" | "WAITING";
export type TodoWorkflowStatus = "TODO" | "IN_PROGRESS" | "BLOCKED" | "DONE";

export type Todo = {
  id: string;
  userId?: string;
  categoryId?: string;
  projectId?: string;
  milestoneId?: string;
  parentTodoId?: string;
  title: string;
  memo?: string;
  date: string;
  dueDate?: string;
  startTime?: string;
  endTime?: string;
  estimateMinutes?: number;
  planningState: TodoPlanningState;
  workflowStatus: TodoWorkflowStatus;
  priority: TodoPriority;
  completed: boolean;
  createdAt: string;
  updatedAt: string;
  repeat: TodoRepeat;
  tags: string[];
  archived: boolean;
  archivedAt?: string;
  order?: number;
  category?: Category;
};

export type TodoInput = {
  title: string;
  categoryId?: string;
  projectId?: string;
  milestoneId?: string;
  parentTodoId?: string;
  memo?: string;
  date?: string;
  dueDate?: string;
  estimateMinutes?: number;
  planningState?: TodoPlanningState;
  workflowStatus?: TodoWorkflowStatus;
  priority?: TodoPriority;
  repeat?: TodoRepeat;
  tags?: string[];
};

export type TodoStatusFilter = "ALL" | "ACTIVE" | "COMPLETED";
export type TodoPriorityFilter = "ALL" | TodoPriority;
export type TodoSort = "NEWEST" | "OLDEST" | "PRIORITY" | "DATE_ASC";

export type TodoFilters = {
  query: string;
  status: TodoStatusFilter;
  priority: TodoPriorityFilter;
  tag: string;
  categoryId: string;
  repeat: "ALL" | TodoRepeat;
  archived: "ACTIVE" | "ARCHIVED" | "ALL";
  duplicatesOnly: boolean;
  date: string;
  sort: TodoSort;
};
