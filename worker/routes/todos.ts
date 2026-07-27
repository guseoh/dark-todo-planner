import { and, asc, desc, eq, inArray, like, max, or, sql } from "drizzle-orm";
import { Hono } from "hono";
import { drizzle } from "drizzle-orm/d1";
import { categories, tags, todoTags, todos } from "../db/schema";
import { serializeCategory, serializeTodos } from "../serializers";
import type { Bindings, Variables } from "../types";
import { newId, normalizeIcon, nowIso, optional, pagination } from "../utils";
import { categoryInputSchema, todoInputSchema } from "../validation";

export const todoRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>();

const syncTags = async (db: ReturnType<typeof drizzle>, userId: string, todoId: string, names: string[]) => {
  await db.delete(todoTags).where(eq(todoTags.todoId, todoId));
  const now = nowIso();
  for (const name of names) {
    let [tag] = await db.select().from(tags).where(and(eq(tags.userId, userId), eq(tags.name, name))).limit(1);
    if (!tag) {
      tag = { id: newId(), userId, name, createdAt: now, updatedAt: now };
      await db.insert(tags).values(tag).onConflictDoNothing();
      [tag] = await db.select().from(tags).where(and(eq(tags.userId, userId), eq(tags.name, name))).limit(1);
    }
    await db.insert(todoTags).values({ todoId, tagId: tag.id }).onConflictDoNothing();
  }
};

todoRoutes.get("/categories", async (c) => {
  const db = drizzle(c.env.DB); const page = pagination((name) => c.req.query(name));
  const rows = await db.select().from(categories).where(eq(categories.userId, c.get("userId"))).orderBy(asc(categories.order), asc(categories.createdAt)).limit(page.limit).offset(page.offset);
  return c.json({ categories: rows.map(serializeCategory), nextCursor: page.next(rows.length) });
});
todoRoutes.post("/categories", async (c) => {
  const input = categoryInputSchema.parse(await c.req.json()); const db = drizzle(c.env.DB); const userId = c.get("userId");
  const [result] = await db.select({ value: max(categories.order) }).from(categories).where(eq(categories.userId, userId)); const now = nowIso();
  const row = { id: newId(), userId, name: input.name, description: optional(input.description), color: input.color || "#6366f1", icon: normalizeIcon(input.icon), order: input.order ?? (result.value ?? -1) + 1, createdAt: now, updatedAt: now };
  await db.insert(categories).values(row); return c.json({ category: serializeCategory(row) }, 201);
});
todoRoutes.patch("/categories/reorder", async (c) => {
  const { ids } = await c.req.json<{ ids: string[] }>(); const db = drizzle(c.env.DB); const userId = c.get("userId"); const now = nowIso();
  await c.env.DB.batch(ids.map((id, order) => c.env.DB.prepare("UPDATE categories SET sort_order = ?, updated_at = ? WHERE id = ? AND user_id = ?").bind(order, now, id, userId)));
  return c.json({ ok: true });
});
todoRoutes.get("/categories/:id/todos", async (c) => {
  const db = drizzle(c.env.DB); const page = pagination((name) => c.req.query(name)); const id = c.req.param("id");
  const condition = id === "uncategorized" ? sql`${todos.categoryId} IS NULL` : eq(todos.categoryId, id);
  const rows = await db.select().from(todos).where(and(eq(todos.userId, c.get("userId")), condition)).orderBy(asc(todos.order), desc(todos.createdAt)).limit(page.limit).offset(page.offset);
  return c.json({ todos: await serializeTodos(db, rows), nextCursor: page.next(rows.length) });
});
todoRoutes.get("/categories/:id", async (c) => {
  const db = drizzle(c.env.DB); const [row] = await db.select().from(categories).where(and(eq(categories.id, c.req.param("id")), eq(categories.userId, c.get("userId")))).limit(1);
  return row ? c.json({ category: serializeCategory(row) }) : c.json({ message: "카테고리를 찾을 수 없습니다." }, 404);
});
todoRoutes.put("/categories/:id", async (c) => {
  const input = categoryInputSchema.parse(await c.req.json()); const db = drizzle(c.env.DB); const id = c.req.param("id"); const userId = c.get("userId");
  const [existing] = await db.select().from(categories).where(and(eq(categories.id, id), eq(categories.userId, userId))).limit(1);
  if (!existing) return c.json({ message: "카테고리를 찾을 수 없습니다." }, 404);
  await db.update(categories).set({ name: input.name, description: optional(input.description), color: input.color || "#6366f1", icon: normalizeIcon(input.icon), order: input.order ?? existing.order, updatedAt: nowIso() }).where(eq(categories.id, id));
  const [row] = await db.select().from(categories).where(eq(categories.id, id)); return c.json({ category: serializeCategory(row) });
});
todoRoutes.delete("/categories/:id", async (c) => {
  const db = drizzle(c.env.DB); const id = c.req.param("id"); const userId = c.get("userId");
  const [existing] = await db.select({ id: categories.id }).from(categories).where(and(eq(categories.id, id), eq(categories.userId, userId))).limit(1);
  if (!existing) return c.json({ message: "카테고리를 찾을 수 없습니다." }, 404);
  if (c.req.query("mode") === "deleteTodos") await db.delete(todos).where(and(eq(todos.userId, userId), eq(todos.categoryId, id)));
  else await db.update(todos).set({ categoryId: null, updatedAt: nowIso() }).where(and(eq(todos.userId, userId), eq(todos.categoryId, id)));
  await db.delete(categories).where(eq(categories.id, id)); return c.json({ ok: true });
});

todoRoutes.get("/todos", async (c) => {
  const db = drizzle(c.env.DB); const userId = c.get("userId"); const page = pagination((name) => c.req.query(name)); const filters = [eq(todos.userId, userId)];
  const categoryId = c.req.query("categoryId"), date = c.req.query("date"), from = c.req.query("from"), to = c.req.query("to"), completed = c.req.query("completed"), priority = c.req.query("priority"), archived = c.req.query("archived"), keyword = c.req.query("keyword")?.trim();
  if (categoryId === "uncategorized") filters.push(sql`${todos.categoryId} IS NULL`); else if (categoryId) filters.push(eq(todos.categoryId, categoryId));
  if (date) filters.push(eq(todos.date, date)); else { if (from) filters.push(sql`${todos.date} >= ${from}`); if (to) filters.push(sql`${todos.date} <= ${to}`); }
  if (completed === "true" || completed === "false") filters.push(eq(todos.completed, completed === "true"));
  if (priority === "LOW" || priority === "MEDIUM" || priority === "HIGH") filters.push(eq(todos.priority, priority));
  if (archived === "true" || archived === "false") filters.push(eq(todos.archived, archived === "true"));
  if (keyword) {
    const pattern = `%${keyword}%`;
    filters.push(or(
      like(todos.title, pattern),
      like(todos.memo, pattern),
      sql`EXISTS (SELECT 1 FROM categories AS search_category WHERE search_category.id = ${todos.categoryId} AND search_category.name LIKE ${pattern})`,
      sql`EXISTS (SELECT 1 FROM todo_tags AS search_todo_tag INNER JOIN tags AS search_tag ON search_tag.id = search_todo_tag.tag_id WHERE search_todo_tag.todo_id = ${todos.id} AND search_tag.name LIKE ${pattern})`,
    )!);
  }
  const rows = await db.select().from(todos).where(and(...filters)).orderBy(asc(todos.order), desc(todos.createdAt)).limit(page.limit).offset(page.offset);
  return c.json({ todos: await serializeTodos(db, rows), nextCursor: page.next(rows.length) });
});
todoRoutes.post("/todos", async (c) => {
  const input = todoInputSchema.parse(await c.req.json()); const db = drizzle(c.env.DB); const userId = c.get("userId");
  if (input.categoryId) { const [category] = await db.select({ id: categories.id }).from(categories).where(and(eq(categories.id, input.categoryId), eq(categories.userId, userId))); if (!category) return c.json({ message: "카테고리를 찾을 수 없습니다." }, 400); }
  const [maximum] = await db.select({ value: max(todos.order) }).from(todos).where(and(eq(todos.userId, userId), input.categoryId ? eq(todos.categoryId, input.categoryId) : sql`${todos.categoryId} IS NULL`)); const now = nowIso();
  const row = { id: newId(), userId, categoryId: input.categoryId || null, title: input.title, memo: optional(input.memo), date: input.date, startTime: optional(input.startTime), endTime: optional(input.endTime), priority: input.priority, completed: input.completed || false, repeat: input.repeat, archived: input.archived || false, archivedAt: input.archived ? now : null, order: input.order ?? (maximum.value ?? -1) + 1, createdAt: now, updatedAt: now };
  await db.insert(todos).values(row); await syncTags(db, userId, row.id, input.tags); return c.json({ todo: (await serializeTodos(db, [row]))[0] }, 201);
});
todoRoutes.patch("/todos/reorder", async (c) => {
  const { ids } = await c.req.json<{ ids: string[] }>(); const now = nowIso(); const userId = c.get("userId");
  await c.env.DB.batch(ids.map((id, order) => c.env.DB.prepare("UPDATE todos SET sort_order = ?, updated_at = ? WHERE id = ? AND user_id = ?").bind(order, now, id, userId))); return c.json({ ok: true });
});
todoRoutes.get("/todos/:id", async (c) => {
  const db = drizzle(c.env.DB); const [row] = await db.select().from(todos).where(and(eq(todos.id, c.req.param("id")), eq(todos.userId, c.get("userId")))).limit(1);
  return row ? c.json({ todo: (await serializeTodos(db, [row]))[0] }) : c.json({ message: "Todo를 찾을 수 없습니다." }, 404);
});
todoRoutes.put("/todos/:id", async (c) => {
  const input = todoInputSchema.parse(await c.req.json()); const db = drizzle(c.env.DB); const id = c.req.param("id"), userId = c.get("userId");
  const [existing] = await db.select().from(todos).where(and(eq(todos.id, id), eq(todos.userId, userId))).limit(1); if (!existing) return c.json({ message: "Todo를 찾을 수 없습니다." }, 404);
  if (input.categoryId) { const [category] = await db.select({ id: categories.id }).from(categories).where(and(eq(categories.id, input.categoryId), eq(categories.userId, userId))); if (!category) return c.json({ message: "카테고리를 찾을 수 없습니다." }, 400); }
  await db.update(todos).set({ categoryId: input.categoryId || null, title: input.title, memo: optional(input.memo), date: input.date, startTime: optional(input.startTime), endTime: optional(input.endTime), priority: input.priority, completed: input.completed ?? existing.completed, repeat: input.repeat, archived: input.archived ?? existing.archived, archivedAt: input.archived === true && !existing.archived ? nowIso() : input.archived === false ? null : existing.archivedAt, order: input.order ?? existing.order, updatedAt: nowIso() }).where(eq(todos.id, id));
  await syncTags(db, userId, id, input.tags); const [row] = await db.select().from(todos).where(eq(todos.id, id)); return c.json({ todo: (await serializeTodos(db, [row]))[0] });
});
todoRoutes.delete("/todos/:id", async (c) => { const db = drizzle(c.env.DB); await db.delete(todos).where(and(eq(todos.id, c.req.param("id")), eq(todos.userId, c.get("userId")))); return c.json({ ok: true }); });

for (const action of ["toggle", "archive", "unarchive"] as const) todoRoutes.patch(`/todos/:id/${action}`, async (c) => {
  const db = drizzle(c.env.DB); const id = c.req.param("id"), userId = c.get("userId"); const [existing] = await db.select().from(todos).where(and(eq(todos.id, id), eq(todos.userId, userId))).limit(1);
  if (!existing) return c.json({ message: "Todo를 찾을 수 없습니다." }, 404);
  const update = action === "toggle" ? { completed: !existing.completed } : action === "archive" ? { archived: true, archivedAt: nowIso() } : { archived: false, archivedAt: null };
  await db.update(todos).set({ ...update, updatedAt: nowIso() }).where(eq(todos.id, id)); const [row] = await db.select().from(todos).where(eq(todos.id, id)); return c.json({ todo: (await serializeTodos(db, [row]))[0] });
});
