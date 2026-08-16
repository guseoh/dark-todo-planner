import { z } from "zod";

export const plannerSettingsInputSchema = z.object({
  carryOverEnabled: z.boolean().default(false),
  autoArchiveCompleted: z.boolean().default(false),
  reminderTodayEnabled: z.boolean().default(true),
  reminderOverdueEnabled: z.boolean().default(false),
  reminderDueSoonEnabled: z.boolean().default(false),
  reminderDueSoonDays: z.coerce.number().int().min(1).max(14).default(3),
});
