import { and, asc, desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { Hono } from "hono";
import { goals, memos, reflections } from "../db/schema";
import { serializeGoal, serializeMemo, serializeReflection } from "../serializers";
import type { Bindings, Variables } from "../types";
import { newId, nowIso, optional, pagination } from "../utils";
import { goalInputSchema, memoInputSchema, reflectionInputSchema } from "../validation";

export const contentRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>();

contentRoutes.get("/reflections", async (c) => {
  const db = drizzle(c.env.DB); const page = pagination((name) => c.req.query(name)); const filters = [eq(reflections.userId, c.get("userId"))];
  const type = c.req.query("type"), date = c.req.query("date");
  if (type === "DAILY" || type === "WEEKLY" || type === "MONTHLY") filters.push(eq(reflections.type, type)); if (date) filters.push(eq(reflections.date, date));
  const rows = await db.select().from(reflections).where(and(...filters)).orderBy(desc(reflections.updatedAt)).limit(page.limit).offset(page.offset);
  return c.json({ reflections: rows.map(serializeReflection), nextCursor: page.next(rows.length) });
});
contentRoutes.post("/reflections", async (c) => {
  const input = reflectionInputSchema.parse(await c.req.json()); const db = drizzle(c.env.DB); const now = nowIso();
  const row = { id: newId(), userId: c.get("userId"), date: input.date, type: input.type, sectionsJson: JSON.stringify(input.sections), content: optional(input.content), createdAt: now, updatedAt: now };
  await db.insert(reflections).values(row); return c.json({ reflection: serializeReflection(row) }, 201);
});
contentRoutes.put("/reflections/:id", async (c) => {
  const input = reflectionInputSchema.parse(await c.req.json()); const db = drizzle(c.env.DB); const id = c.req.param("id"), userId = c.get("userId");
  const [existing] = await db.select().from(reflections).where(and(eq(reflections.id, id), eq(reflections.userId, userId))).limit(1); if (!existing) return c.json({ message: "회고를 찾을 수 없습니다." }, 404);
  await db.update(reflections).set({ date: input.date, type: input.type, content: optional(input.content), sectionsJson: JSON.stringify(input.sections), updatedAt: nowIso() }).where(eq(reflections.id, id));
  const [row] = await db.select().from(reflections).where(eq(reflections.id, id)); return c.json({ reflection: serializeReflection(row) });
});
contentRoutes.delete("/reflections/:id", async (c) => { const db = drizzle(c.env.DB); await db.delete(reflections).where(and(eq(reflections.id, c.req.param("id")), eq(reflections.userId, c.get("userId")))); return c.json({ ok: true }); });

contentRoutes.get("/goals", async (c) => {
  const db = drizzle(c.env.DB); const page = pagination((name) => c.req.query(name)); const filters = [eq(goals.userId, c.get("userId"))]; const type = c.req.query("type");
  if (type === "DAILY" || type === "WEEKLY" || type === "MONTHLY") filters.push(eq(goals.type, type));
  if (c.req.query("date")) filters.push(eq(goals.targetDate, c.req.query("date")!)); if (c.req.query("weekStartDate")) filters.push(eq(goals.weekStartDate, c.req.query("weekStartDate")!)); if (c.req.query("month")) filters.push(eq(goals.month, c.req.query("month")!));
  const rows = await db.select().from(goals).where(and(...filters)).orderBy(asc(goals.completed), asc(goals.dueDate), desc(goals.createdAt)).limit(page.limit).offset(page.offset);
  return c.json({ goals: rows.map(serializeGoal), nextCursor: page.next(rows.length) });
});
contentRoutes.get("/goals/:id", async (c) => { const db = drizzle(c.env.DB); const [row] = await db.select().from(goals).where(and(eq(goals.id, c.req.param("id")), eq(goals.userId, c.get("userId")))).limit(1); return row ? c.json({ goal: serializeGoal(row) }) : c.json({ message: "목표를 찾을 수 없습니다." }, 404); });
contentRoutes.post("/goals", async (c) => {
  const input = goalInputSchema.parse(await c.req.json()); const db = drizzle(c.env.DB); const now = nowIso();
  const row = { id: newId(), userId: c.get("userId"), title: input.title, description: optional(input.description), type: input.type, targetDate: optional(input.targetDate), weekStartDate: optional(input.weekStartDate), weekEndDate: optional(input.weekEndDate), month: optional(input.month), dueDate: optional(input.dueDate), progress: input.progress, completed: input.completed || false, createdAt: now, updatedAt: now };
  await db.insert(goals).values(row); return c.json({ goal: serializeGoal(row) }, 201);
});
contentRoutes.put("/goals/:id", async (c) => {
  const input = goalInputSchema.parse(await c.req.json()); const db = drizzle(c.env.DB); const id = c.req.param("id"), userId = c.get("userId"); const [existing] = await db.select().from(goals).where(and(eq(goals.id, id), eq(goals.userId, userId))).limit(1); if (!existing) return c.json({ message: "목표를 찾을 수 없습니다." }, 404);
  await db.update(goals).set({ title: input.title, description: optional(input.description), type: input.type, targetDate: optional(input.targetDate), weekStartDate: optional(input.weekStartDate), weekEndDate: optional(input.weekEndDate), month: optional(input.month), dueDate: optional(input.dueDate), progress: input.progress, completed: input.completed ?? existing.completed, updatedAt: nowIso() }).where(eq(goals.id, id)); const [row] = await db.select().from(goals).where(eq(goals.id, id)); return c.json({ goal: serializeGoal(row) });
});
contentRoutes.patch("/goals/:id/toggle", async (c) => { const db = drizzle(c.env.DB); const id = c.req.param("id"), userId = c.get("userId"); const [existing] = await db.select().from(goals).where(and(eq(goals.id, id), eq(goals.userId, userId))).limit(1); if (!existing) return c.json({ message: "목표를 찾을 수 없습니다." }, 404); await db.update(goals).set({ completed: !existing.completed, progress: existing.completed ? 0 : 100, updatedAt: nowIso() }).where(eq(goals.id, id)); const [row] = await db.select().from(goals).where(eq(goals.id, id)); return c.json({ goal: serializeGoal(row) }); });
contentRoutes.delete("/goals/:id", async (c) => { const db = drizzle(c.env.DB); await db.delete(goals).where(and(eq(goals.id, c.req.param("id")), eq(goals.userId, c.get("userId")))); return c.json({ ok: true }); });

contentRoutes.get("/memos", async (c) => { const db = drizzle(c.env.DB); const page = pagination((name) => c.req.query(name)); const rows = await db.select().from(memos).where(eq(memos.userId, c.get("userId"))).orderBy(desc(memos.pinned), desc(memos.updatedAt)).limit(page.limit).offset(page.offset); return c.json({ memos: rows.map(serializeMemo), nextCursor: page.next(rows.length) }); });
contentRoutes.get("/memos/:id", async (c) => { const db = drizzle(c.env.DB); const [row] = await db.select().from(memos).where(and(eq(memos.id, c.req.param("id")), eq(memos.userId, c.get("userId")))).limit(1); return row ? c.json({ memo: serializeMemo(row) }) : c.json({ message: "메모를 찾을 수 없습니다." }, 404); });
contentRoutes.post("/memos", async (c) => { const input = memoInputSchema.parse(await c.req.json()); const db = drizzle(c.env.DB); const now = nowIso(); const row = { id: newId(), userId: c.get("userId"), title: optional(input.title), content: input.content, color: optional(input.color), pinned: input.pinned || false, createdAt: now, updatedAt: now }; await db.insert(memos).values(row); return c.json({ memo: serializeMemo(row) }, 201); });
contentRoutes.put("/memos/:id", async (c) => { const input = memoInputSchema.parse(await c.req.json()); const db = drizzle(c.env.DB); const id = c.req.param("id"), userId = c.get("userId"); const [existing] = await db.select().from(memos).where(and(eq(memos.id, id), eq(memos.userId, userId))).limit(1); if (!existing) return c.json({ message: "메모를 찾을 수 없습니다." }, 404); await db.update(memos).set({ title: optional(input.title), content: input.content, color: optional(input.color), pinned: input.pinned ?? existing.pinned, updatedAt: nowIso() }).where(eq(memos.id, id)); const [row] = await db.select().from(memos).where(eq(memos.id, id)); return c.json({ memo: serializeMemo(row) }); });
contentRoutes.patch("/memos/:id/pin", async (c) => { const db = drizzle(c.env.DB); const id = c.req.param("id"), userId = c.get("userId"); const [existing] = await db.select().from(memos).where(and(eq(memos.id, id), eq(memos.userId, userId))).limit(1); if (!existing) return c.json({ message: "메모를 찾을 수 없습니다." }, 404); await db.update(memos).set({ pinned: !existing.pinned, updatedAt: nowIso() }).where(eq(memos.id, id)); const [row] = await db.select().from(memos).where(eq(memos.id, id)); return c.json({ memo: serializeMemo(row) }); });
contentRoutes.delete("/memos/:id", async (c) => { const db = drizzle(c.env.DB); await db.delete(memos).where(and(eq(memos.id, c.req.param("id")), eq(memos.userId, c.get("userId")))); return c.json({ ok: true }); });
