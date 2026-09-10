import { z } from "zod";

const optionalId = z.union([z.string().trim().min(1).max(120), z.literal(""), z.null()]).optional();

export const routineItemSchema = z.object({
  title: z.string().trim().min(1).max(240),
  priority: z.enum(["LOW", "MEDIUM", "HIGH"]).default("MEDIUM"),
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
