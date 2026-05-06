export type TodoPriority = "LOW" | "MEDIUM" | "HIGH";

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
};

export type TodoInput = {
  title: string;
  memo?: string;
  date?: string;
  startTime?: string;
  endTime?: string;
  priority?: TodoPriority;
};

export type TodoStatusFilter = "ALL" | "ACTIVE" | "COMPLETED";
export type TodoPriorityFilter = "ALL" | TodoPriority;
export type TodoSort = "NEWEST" | "OLDEST" | "PRIORITY" | "DATE_ASC";

export type TodoFilters = {
  query: string;
  status: TodoStatusFilter;
  priority: TodoPriorityFilter;
  date: string;
  sort: TodoSort;
};
