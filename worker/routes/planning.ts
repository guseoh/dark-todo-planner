import { and, desc, eq, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { Hono } from "hono";
import { todos } from "../db/schema";
import { dailyPlans } from "../db/planningSchema";
import { dailyPlanInputSchema } from "../planningValidation";
import type { Bindings, Variables } from "../types";
import { newId, nowIso, optional } from "../utils";

export const dailyPlanRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>();

const parseArray = (value: string) => {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
};

const serializeDailyPlan = (row: typeof dailyPlans.$inferSelect) => ({
  ...row,
  focusText: row.focusText || undefined,
  topTodoIdsJson: undefined,
  topTodoIds: parseArray(row.topTodoIdsJson),
});

dailyPlanRoutes.get("/daily-plans", async (c) => {
  const db = drizzle(c.env.DB);
  const date = c.req.query("date");
  const filters = [eq(dailyPlans.userId, c.get("userId"))];
  if (date) filters.push(eq(dailyPlans.date, date));
  const rows = await db.select().from(dailyPlans).where(and(...filters)).orderBy(desc(dailyPlans.date)).limit(date ? 1 : 31);
  return c.json({ dailyPlans: rows.map(serializeDailyPlan) });
});

dailyPlanRoutes.put("/daily-plans/:date", async (c) => {
  const input = dailyPlanInputSchema.parse(await c.req.json());
  const db = drizzle(c.env.DB);
  const userId = c.get("userId");
  const date = c.req.param("date");
  const uniqueIds = Array.from(new Set(input.topTodoIds));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return c.json({ message: "올바른 날짜를 입력하세요." }, 400);
  const owned = uniqueIds.length
    ? await db.select({ id: todos.id }).from(todos).where(and(eq(todos.userId, userId), inArray(todos.id, uniqueIds)))
    : [];
  const ownedIds = new Set(owned.map(({ id }) => id));
  const validIds = uniqueIds.filter((id) => ownedIds.has(id));
  const now = nowIso();
  const values = { focusText: optional(input.focusText), topTodoIdsJson: JSON.stringify(validIds), updatedAt: now };
  const [row] = await db.insert(dailyPlans).values({ id: newId(), userId, date, createdAt: now, ...values })
    .onConflictDoUpdate({ target: [dailyPlans.userId, dailyPlans.date], set: values }).returning();
  return c.json({ dailyPlan: serializeDailyPlan(row) });
});
