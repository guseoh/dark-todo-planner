import type { Goal } from "../types/goal";

export const DAY_STATUS_GOAL_TITLE = "__DAY_STATUS__";

export type DayStatus = "O" | "X";

export const isDayStatusGoal = (goal: Goal) =>
  goal.type === "DAILY" && goal.title === DAY_STATUS_GOAL_TITLE;

export const getVisibleGoals = (goals: Goal[]) => goals.filter((goal) => !isDayStatusGoal(goal));

export const getDayStatusGoal = (goals: Goal[], dateKey: string) =>
  goals.find((goal) => isDayStatusGoal(goal) && (goal.targetDate === dateKey || goal.dueDate === dateKey));

export const getDayStatus = (goals: Goal[], dateKey: string): DayStatus | undefined => {
  const statusGoal = getDayStatusGoal(goals, dateKey);
  if (!statusGoal) return undefined;
  return statusGoal.completed ? "O" : "X";
};
