export type GoalType = "DAILY" | "WEEKLY" | "MONTHLY";

export type Goal = {
  id: string;
  userId?: string;
  title: string;
  description?: string;
  type: GoalType;
  targetDate?: string;
  weekStartDate?: string;
  weekEndDate?: string;
  month?: string;
  dueDate?: string;
  progress: number;
  completed: boolean;
  createdAt: string;
  updatedAt: string;
};
