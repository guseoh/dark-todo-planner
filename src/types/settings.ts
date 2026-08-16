export type PlannerSettings = {
  id?: string;
  userId?: string;
  carryOverEnabled: boolean;
  autoArchiveCompleted: boolean;
  reminderTodayEnabled: boolean;
  reminderOverdueEnabled: boolean;
  reminderDueSoonEnabled: boolean;
  reminderDueSoonDays: number;
  createdAt?: string;
  updatedAt?: string;
};

export type PlannerSettingsInput = Omit<PlannerSettings, "id" | "userId" | "createdAt" | "updatedAt">;

export type PlannerAutomationResult = {
  plannerDate: string;
  carriedOver: number;
  autoArchived: number;
};
