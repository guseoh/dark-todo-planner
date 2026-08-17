import { z } from "zod";

export const reminderInputSchema = z.object({
  remindAt: z.string().datetime({ offset: true }),
  channel: z.literal("DISCORD").optional().default("DISCORD"),
});

export const reminderSnoozeSchema = z.object({
  preset: z.enum(["10m", "30m", "1h", "tomorrow"]),
});

const optionalId = z.union([z.string().trim().min(1).max(120), z.literal(""), z.null()]).optional();

export const routineItemSchema = z.object({
  title: z.string().trim().min(1).max(240),
  priority: z.enum(["LOW", "MEDIUM", "HIGH"]).default("MEDIUM"),
  estimateMinutes: z.number().int().min(1).max(1440).nullable().optional(),
  projectId: optionalId,
  categoryId: optionalId,
});

export const routineTemplateSchema = z.object({
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(500).nullable().optional(),
  items: z.array(routineItemSchema).min(1).max(30),
});

export const routineRunSchema = z.object({
  targetDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});
