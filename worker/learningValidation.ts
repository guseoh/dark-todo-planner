import { z } from "zod";

export const learningDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const httpUrlSchema = z.string().trim().max(2048).url().refine((value) => {
  try {
    const protocol = new URL(value).protocol;
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}, "http 또는 https 링크만 사용할 수 있습니다.");

export const learningImportItemSchema = z.object({
  learningDate: learningDateSchema,
  type: z.enum(["DAILY_PROBLEM", "TECH_BLOG"]),
  title: z.string().trim().min(1).max(240),
  summary: z.string().trim().max(8000).nullable().optional(),
  sourceUrl: z.union([httpUrlSchema, z.literal(""), z.null()]).optional(),
  sourceName: z.string().trim().max(80).nullable().optional(),
  categories: z.array(z.string().trim().min(1).max(80)).max(2).optional(),
  externalKey: z.string().trim().min(1).max(240),
});

export const learningImportSchema = z.object({
  items: z.array(learningImportItemSchema).min(1).max(40),
});

export const learningStatusSchema = z.object({
  status: z.enum(["UNREAD", "READING", "DONE", "SKIPPED"]),
});

export const learningTodoSchema = z.object({ date: learningDateSchema });
