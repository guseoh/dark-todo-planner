export type PlannerSettings = {
  id?: string;
  userId?: string;
  carryOverEnabled: boolean;
  autoArchiveCompleted: boolean;
  reminderTodayEnabled: boolean;
  reminderOverdueEnabled: boolean;
  reminderDueSoonEnabled: boolean;
  reminderDueSoonDays: number;
  /** Daily time-tracking goal in minutes (0 = no goal). */
  dailyGoalMinutes: number;
  /** Kanban WIP limits per project and workflow status. */
  wipLimits: Record<string, Partial<Record<"TODO" | "IN_PROGRESS" | "BLOCKED" | "DONE", number>>>;
  createdAt?: string;
  updatedAt?: string;
};

export type PlannerSettingsInput = Omit<PlannerSettings, "id" | "userId" | "createdAt" | "updatedAt" | "dailyGoalMinutes" | "wipLimits">;
export type PlannerPreferencesPatch = Partial<Pick<PlannerSettings, "dailyGoalMinutes" | "wipLimits">>;

export type PlannerAutomationResult = {
  plannerDate: string;
  carriedOver: number;
  autoArchived: number;
};
