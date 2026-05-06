export type TodoPriority = "LOW" | "MEDIUM" | "HIGH";
export type TodoRepeat = "NONE" | "DAILY" | "WEEKLY" | "MONTHLY" | "WEEKDAY" | "WEEKEND";

export type Todo = {
  id: string;
  title: string;
  memo?: string;
  date: string;
  startTime?: string;
  endTime?: string;
  priority: TodoPriority;
  completed: boolean;
  createdAt: string;
  updatedAt: string;
  repeat: TodoRepeat;
  tags: string[];
  archived: boolean;
  archivedAt?: string;
};

export type TodoInput = {
  title: string;
  memo?: string;
  date?: string;
  startTime?: string;
  endTime?: string;
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
  date: string;
  sort: TodoSort;
};
