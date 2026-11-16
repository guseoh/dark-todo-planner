import { and, eq, gte, lte } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { Hono } from "hono";
import { z } from "zod";
import { reflections } from "../db/schema";
import type { Bindings, Variables } from "../types";
import { newId, nowIso } from "../utils";

/** One short end-of-day note per planner date, stored in the existing DAILY reflections. */
export const reflectionRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>();

const dateKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const noteSchema = z.object({ content: z.string().trim().max(1000) });

const serialize = (row: typeof reflections.$inferSelect) => ({ date: row.date, content: row.content ?? "", updatedAt: row.updatedAt });

reflectionRoutes.get("/reflections", async (c) => {
  const from = dateKey.parse(c.req.query("from")); const to = dateKey.parse(c.req.query("to"));
  const rows = await drizzle(c.env.DB).select().from(reflections)
    .where(and(eq(reflections.userId, c.get("userId")), eq(reflections.type, "DAILY"), gte(reflections.date, from), lte(reflections.date, to)))
    .limit(400);
  return c.json({ reflections: rows.filter((row) => row.content).map(serialize) });
});

reflectionRoutes.put("/reflections/daily/:date", async (c) => {
  const date = dateKey.parse(c.req.param("date"));
  const { content } = noteSchema.parse(await c.req.json());
  const db = drizzle(c.env.DB); const userId = c.get("userId");
  const existing = await db.select().from(reflections).where(and(eq(reflections.userId, userId), eq(reflections.type, "DAILY"), eq(reflections.date, date)));
  if (!content) {
    for (const row of existing) await db.delete(reflections).where(eq(reflections.id, row.id));
    return c.json({ reflection: { date, content: "", updatedAt: nowIso() } });
  }
  const now = nowIso();
  if (existing.length) await db.update(reflections).set({ content, updatedAt: now }).where(eq(reflections.id, existing[0].id));
  else await db.insert(reflections).values({ id: newId(), userId, date, type: "DAILY", sectionsJson: "[]", content, createdAt: now, updatedAt: now });
  return c.json({ reflection: { date, content, updatedAt: now } });
});
