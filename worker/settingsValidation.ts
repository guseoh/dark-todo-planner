import { z } from "zod";

const wipLimitsSchema = z.record(z.string().min(1).max(64), z.partialRecord(z.enum(["TODO", "IN_PROGRESS", "BLOCKED", "DONE"]), z.number().int().min(1).max(999)))
  .refine((value) => Object.keys(value).length <= 200, "프로젝트 한도가 너무 많습니다.");

/** Partial update for preferences that other screens save on their own (time goal, kanban WIP limits). */
export const plannerPreferencesPatchSchema = z.object({
  dailyGoalMinutes: z.coerce.number().int().min(0).max(1440).optional(),
  wipLimits: wipLimitsSchema.optional(),
}).refine((value) => value.dailyGoalMinutes !== undefined || value.wipLimits !== undefined, "변경할 값이 없습니다.");

export const plannerSettingsInputSchema = z.object({
  carryOverEnabled: z.boolean().default(false),
  autoArchiveCompleted: z.boolean().default(false),
  reminderTodayEnabled: z.boolean().default(true),
  reminderOverdueEnabled: z.boolean().default(false),
  reminderDueSoonEnabled: z.boolean().default(false),
  reminderDueSoonDays: z.coerce.number().int().min(1).max(14).default(3),
});
