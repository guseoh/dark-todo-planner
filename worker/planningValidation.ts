import { z } from "zod";

const savedViewQuerySchema = z.object({
  planningState: z.enum(["ALL", "INBOX", "SCHEDULED", "SOMEDAY", "WAITING"]).optional(),
  workflowStatus: z.enum(["ALL", "TODO", "IN_PROGRESS", "BLOCKED", "DONE"]).optional(),
  priority: z.enum(["ALL", "LOW", "MEDIUM", "HIGH"]).optional(),
  projectId: z.string().optional(),
  dueMode: z.enum(["ANY", "OVERDUE", "DUE_SOON", "NO_DUE"]).optional(),
}).default({});

export const dailyPlanInputSchema = z.object({
  focusText: z.string().max(2000).optional().nullable(),
  topTodoIds: z.array(z.string().min(1)).max(5).default([]),
});

export const weeklyReviewInputSchema = z.object({
  wins: z.string().max(5000).optional().nullable(),
  blockers: z.string().max(5000).optional().nullable(),
  lessons: z.string().max(5000).optional().nullable(),
  nextFocus: z.string().max(5000).optional().nullable(),
});

export const savedViewInputSchema = z.object({
  name: z.string().trim().min(1).max(80),
  query: savedViewQuerySchema,
});

export const taskTemplateInputSchema = z.object({
  name: z.string().trim().min(1).max(80),
  todo: z.object({
    title: z.string().trim().min(1).max(300),
    categoryId: z.string().optional().nullable(),
    projectId: z.string().optional().nullable(),
    milestoneId: z.string().optional().nullable(),
    parentTodoId: z.string().optional().nullable(),
    memo: z.string().max(10000).optional().nullable(),
    dueDate: z.string().optional().nullable(),
    estimateMinutes: z.coerce.number().int().min(1).max(1440).optional().nullable(),
    planningState: z.enum(["INBOX", "SCHEDULED", "SOMEDAY", "WAITING"]).default("SCHEDULED"),
    workflowStatus: z.enum(["TODO", "IN_PROGRESS", "BLOCKED", "DONE"]).default("TODO"),
    priority: z.enum(["LOW", "MEDIUM", "HIGH"]).default("MEDIUM"),
    repeat: z.enum(["NONE", "DAILY", "WEEKLY", "MONTHLY", "WEEKDAY", "WEEKEND"]).default("NONE"),
    tags: z.array(z.string()).optional().default([]).transform((values) => Array.from(new Set(values.map((value) => value.trim().replace(/^#/, "")).filter(Boolean)))),
  }),
});
