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
  referenceUrl?: string;
  referenceLabel?: string;
  date: string;
  dueDate?: string;
  startTime?: string;
  endTime?: string;
  /** Legacy persisted value kept for backup/storage compatibility. Not exposed by the Todo editor. */
  estimateMinutes?: number;
  planningState: TodoPlanningState;
  workflowStatus: TodoWorkflowStatus;
  priority: TodoPriority;
  completed: boolean;
  createdAt: string;
  updatedAt: string;
  /** Legacy persisted value kept for existing records. Missing values are treated as NONE. */
  repeat?: TodoRepeat;
  /** Legacy persisted values kept for existing records. Tag editing/filtering is no longer exposed. */
  tags?: string[];
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
  /** Compatibility-only field for legacy/internal callers. */
  estimateMinutes?: number;
  planningState?: TodoPlanningState;
  workflowStatus?: TodoWorkflowStatus;
  priority?: TodoPriority;
  /** Compatibility-only field. New Todo flows use NONE. */
  repeat?: TodoRepeat;
  /** Compatibility-only field. New Todo flows use an empty list. */
  tags?: string[];
};

export type TodoBulkAction =
  | { type: "PROJECT"; value: string | null }
  | { type: "DATE"; value: string }
  | { type: "WORKFLOW_STATUS"; value: TodoWorkflowStatus }
  | { type: "PRIORITY"; value: TodoPriority };

export type TodoStatusFilter = "ALL" | "ACTIVE" | "COMPLETED";
export type TodoPriorityFilter = "ALL" | TodoPriority;
export type TodoSort = "NEWEST" | "OLDEST" | "PRIORITY" | "DATE_ASC";

export type TodoFilters = {
  query: string;
  status: TodoStatusFilter;
  priority: TodoPriorityFilter;
  categoryId: string;
  archived: "ACTIVE" | "ARCHIVED" | "ALL";
  duplicatesOnly: boolean;
  date: string;
  sort: TodoSort;
};
