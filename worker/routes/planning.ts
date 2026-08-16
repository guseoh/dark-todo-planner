import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { Hono } from "hono";
import { todos } from "../db/schema";
import { dailyPlans, savedViews, taskTemplates, weeklyReviews } from "../db/planningSchema";
import { dailyPlanInputSchema, savedViewInputSchema, taskTemplateInputSchema, weeklyReviewInputSchema } from "../planningValidation";
import type { Bindings, Variables } from "../types";
import { newId, nowIso, optional } from "../utils";

export const planningRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>();

const parseArray = (value: string) => {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
};

const parseObject = <T extends Record<string, unknown>>(value: string, fallback: T): T => {
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as T : fallback;
  } catch {
    return fallback;
  }
};

const serializeDailyPlan = (row: typeof dailyPlans.$inferSelect) => ({
  ...row,
  focusText: row.focusText || undefined,
  topTodoIdsJson: undefined,
  topTodoIds: parseArray(row.topTodoIdsJson),
});

const serializeWeeklyReview = (row: typeof weeklyReviews.$inferSelect) => ({
  ...row,
  wins: row.wins || undefined,
  blockers: row.blockers || undefined,
  lessons: row.lessons || undefined,
  nextFocus: row.nextFocus || undefined,
});

const serializeSavedView = (row: typeof savedViews.$inferSelect) => ({
  ...row,
  queryJson: undefined,
  query: parseObject(row.queryJson, {}),
});

const serializeTaskTemplate = (row: typeof taskTemplates.$inferSelect) => ({
  ...row,
  todoJson: undefined,
  todo: parseObject(row.todoJson, { title: row.name }),
});

planningRoutes.get("/daily-plans", async (c) => {
  const db = drizzle(c.env.DB);
  const date = c.req.query("date");
  const filters = [eq(dailyPlans.userId, c.get("userId"))];
  if (date) filters.push(eq(dailyPlans.date, date));
  const rows = await db.select().from(dailyPlans).where(and(...filters)).orderBy(desc(dailyPlans.date)).limit(date ? 1 : 31);
  return c.json({ dailyPlans: rows.map(serializeDailyPlan) });
});

planningRoutes.put("/daily-plans/:date", async (c) => {
  const input = dailyPlanInputSchema.parse(await c.req.json());
  const db = drizzle(c.env.DB);
  const userId = c.get("userId");
  const date = c.req.param("date");
  const uniqueIds = Array.from(new Set(input.topTodoIds));
  const validIds = uniqueIds.length
    ? (await db.select({ id: todos.id }).from(todos).where(and(eq(todos.userId, userId), inArray(todos.id, uniqueIds)))).map((row) => row.id)
    : [];
  const now = nowIso();
  const [existing] = await db.select().from(dailyPlans).where(and(eq(dailyPlans.userId, userId), eq(dailyPlans.date, date))).limit(1);
  if (existing) {
    await db.update(dailyPlans).set({ focusText: optional(input.focusText), topTodoIdsJson: JSON.stringify(validIds), updatedAt: now }).where(eq(dailyPlans.id, existing.id));
  } else {
    await db.insert(dailyPlans).values({ id: newId(), userId, date, focusText: optional(input.focusText), topTodoIdsJson: JSON.stringify(validIds), createdAt: now, updatedAt: now });
  }
  const [row] = await db.select().from(dailyPlans).where(and(eq(dailyPlans.userId, userId), eq(dailyPlans.date, date))).limit(1);
  return c.json({ dailyPlan: serializeDailyPlan(row) });
});

planningRoutes.get("/weekly-reviews", async (c) => {
  const db = drizzle(c.env.DB);
  const weekStartDate = c.req.query("weekStartDate");
  const filters = [eq(weeklyReviews.userId, c.get("userId"))];
  if (weekStartDate) filters.push(eq(weeklyReviews.weekStartDate, weekStartDate));
  const rows = await db.select().from(weeklyReviews).where(and(...filters)).orderBy(desc(weeklyReviews.weekStartDate)).limit(weekStartDate ? 1 : 12);
  return c.json({ weeklyReviews: rows.map(serializeWeeklyReview) });
});

planningRoutes.put("/weekly-reviews/:weekStartDate", async (c) => {
  const input = weeklyReviewInputSchema.parse(await c.req.json());
  const db = drizzle(c.env.DB);
  const userId = c.get("userId");
  const weekStartDate = c.req.param("weekStartDate");
  const now = nowIso();
  const [existing] = await db.select().from(weeklyReviews).where(and(eq(weeklyReviews.userId, userId), eq(weeklyReviews.weekStartDate, weekStartDate))).limit(1);
  const values = { wins: optional(input.wins), blockers: optional(input.blockers), lessons: optional(input.lessons), nextFocus: optional(input.nextFocus), updatedAt: now };
  if (existing) await db.update(weeklyReviews).set(values).where(eq(weeklyReviews.id, existing.id));
  else await db.insert(weeklyReviews).values({ id: newId(), userId, weekStartDate, ...values, createdAt: now });
  const [row] = await db.select().from(weeklyReviews).where(and(eq(weeklyReviews.userId, userId), eq(weeklyReviews.weekStartDate, weekStartDate))).limit(1);
  return c.json({ weeklyReview: serializeWeeklyReview(row) });
});

planningRoutes.get("/saved-views", async (c) => {
  const db = drizzle(c.env.DB);
  const rows = await db.select().from(savedViews).where(eq(savedViews.userId, c.get("userId"))).orderBy(asc(savedViews.name), asc(savedViews.createdAt));
  return c.json({ savedViews: rows.map(serializeSavedView) });
});

planningRoutes.post("/saved-views", async (c) => {
  const input = savedViewInputSchema.parse(await c.req.json());
  const db = drizzle(c.env.DB);
  const now = nowIso();
  const row = { id: newId(), userId: c.get("userId"), name: input.name, queryJson: JSON.stringify(input.query), createdAt: now, updatedAt: now };
  await db.insert(savedViews).values(row);
  return c.json({ savedView: serializeSavedView(row) }, 201);
});

planningRoutes.put("/saved-views/:id", async (c) => {
  const input = savedViewInputSchema.parse(await c.req.json());
  const db = drizzle(c.env.DB);
  const id = c.req.param("id");
  const [existing] = await db.select().from(savedViews).where(and(eq(savedViews.id, id), eq(savedViews.userId, c.get("userId")))).limit(1);
  if (!existing) return c.json({ message: "저장된 보기를 찾을 수 없습니다." }, 404);
  await db.update(savedViews).set({ name: input.name, queryJson: JSON.stringify(input.query), updatedAt: nowIso() }).where(eq(savedViews.id, id));
  const [row] = await db.select().from(savedViews).where(eq(savedViews.id, id));
  return c.json({ savedView: serializeSavedView(row) });
});

planningRoutes.delete("/saved-views/:id", async (c) => {
  const db = drizzle(c.env.DB);
  await db.delete(savedViews).where(and(eq(savedViews.id, c.req.param("id")), eq(savedViews.userId, c.get("userId"))));
  return c.json({ ok: true });
});

planningRoutes.get("/task-templates", async (c) => {
  const db = drizzle(c.env.DB);
  const rows = await db.select().from(taskTemplates).where(eq(taskTemplates.userId, c.get("userId"))).orderBy(asc(taskTemplates.name), asc(taskTemplates.createdAt));
  return c.json({ taskTemplates: rows.map(serializeTaskTemplate) });
});

planningRoutes.post("/task-templates", async (c) => {
  const input = taskTemplateInputSchema.parse(await c.req.json());
  const db = drizzle(c.env.DB);
  const now = nowIso();
  const row = { id: newId(), userId: c.get("userId"), name: input.name, todoJson: JSON.stringify(input.todo), createdAt: now, updatedAt: now };
  await db.insert(taskTemplates).values(row);
  return c.json({ taskTemplate: serializeTaskTemplate(row) }, 201);
});

planningRoutes.put("/task-templates/:id", async (c) => {
  const input = taskTemplateInputSchema.parse(await c.req.json());
  const db = drizzle(c.env.DB);
  const id = c.req.param("id");
  const [existing] = await db.select().from(taskTemplates).where(and(eq(taskTemplates.id, id), eq(taskTemplates.userId, c.get("userId")))).limit(1);
  if (!existing) return c.json({ message: "Todo 템플릿을 찾을 수 없습니다." }, 404);
  await db.update(taskTemplates).set({ name: input.name, todoJson: JSON.stringify(input.todo), updatedAt: nowIso() }).where(eq(taskTemplates.id, id));
  const [row] = await db.select().from(taskTemplates).where(eq(taskTemplates.id, id));
  return c.json({ taskTemplate: serializeTaskTemplate(row) });
});

planningRoutes.delete("/task-templates/:id", async (c) => {
  const db = drizzle(c.env.DB);
  await db.delete(taskTemplates).where(and(eq(taskTemplates.id, c.req.param("id")), eq(taskTemplates.userId, c.get("userId"))));
  return c.json({ ok: true });
});
