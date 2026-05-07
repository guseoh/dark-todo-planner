import { z } from "zod";

export const prioritySchema = z.enum(["LOW", "MEDIUM", "HIGH"]);
export const repeatSchema = z.enum(["NONE", "DAILY", "WEEKLY", "MONTHLY", "WEEKDAY", "WEEKEND"]);
export const reflectionTypeSchema = z.enum(["DAILY", "WEEKLY", "MONTHLY"]);
export const goalTypeSchema = z.enum(["DAILY", "WEEKLY", "MONTHLY"]);
export const topicStatusSchema = z.enum(["IDEA", "WRITING", "DONE"]);
export const musicProviderSchema = z.enum(["YOUTUBE", "YOUTUBE_MUSIC", "MELON", "SPOTIFY", "ETC"]);

export const tagsSchema = z
  .array(z.string())
  .optional()
  .default([])
  .transform((tags) =>
    Array.from(new Set(tags.map((tag) => tag.trim().replace(/^#/, "")).filter(Boolean))),
  );

export const todoInputSchema = z.object({
  categoryId: z.string().nullable().optional(),
  title: z.string().trim().min(1),
  memo: z.string().optional().nullable(),
  date: z.string().min(1),
  startTime: z.string().optional().nullable(),
  endTime: z.string().optional().nullable(),
  priority: prioritySchema.default("MEDIUM"),
  completed: z.boolean().optional(),
  repeat: repeatSchema.default("NONE"),
  archived: z.boolean().optional(),
  order: z.number().int().optional(),
  tags: tagsSchema,
});

export const categoryInputSchema = z.object({
  name: z.string().trim().min(1),
  description: z.string().optional().nullable(),
  color: z.string().optional().nullable(),
  order: z.number().int().optional(),
});

export const reflectionSectionSchema = z.object({
  id: z.string(),
  title: z.string(),
  content: z.string().default(""),
  order: z.number().int(),
});

export const reflectionInputSchema = z.object({
  date: z.string().min(1),
  type: reflectionTypeSchema,
  content: z.string().optional().nullable(),
  sections: z.array(reflectionSectionSchema).default([]),
});

export const goalInputSchema = z.object({
  title: z.string().trim().min(1),
  description: z.string().optional().nullable(),
  type: goalTypeSchema.default("DAILY"),
  targetDate: z.string().optional().nullable(),
  weekStartDate: z.string().optional().nullable(),
  weekEndDate: z.string().optional().nullable(),
  month: z.string().optional().nullable(),
  dueDate: z.string().optional().nullable(),
  progress: z.coerce.number().int().min(0).max(100).default(0),
  completed: z.boolean().optional(),
});

export const topicInputSchema = z.object({
  title: z.string().trim().min(1),
  memo: z.string().optional().nullable(),
  status: topicStatusSchema.default("IDEA"),
  tags: tagsSchema,
});

export const topicLinkInputSchema = z.object({
  title: z.string().optional().nullable(),
  url: z.string().url(),
  description: z.string().optional().nullable(),
});

export const musicLinkInputSchema = z.object({
  title: z.string().trim().min(1),
  url: z.string().url(),
  provider: musicProviderSchema.optional().default("ETC"),
  memo: z.string().optional().nullable(),
});
