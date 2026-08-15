import { and, asc, desc, eq, like, max, or, sql } from "drizzle-orm";
import { Hono } from "hono";
import { drizzle } from "drizzle-orm/d1";
import { categories, milestones, projects, tags, todoTags, todos } from "../db/schema";
import { serializeCategory, serializeTodos } from "../serializers";
import type { Bindings, Variables } from "../types";
import { newId, normalizeIcon, nowIso, optional, pagination } from "../utils";
import { bulkTodoUpdateSchema, categoryInputSchema, todoInputSchema } from "../validation";

export const todoRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>();

const BULK_DELETE_CHUNK_SIZE = 80;
const MAX_BULK_DELETE_IDS = BULK_DELETE_CHUNK_SIZE * 50;

export const normalizeBulkTodoIds = (rawIds: unknown): string[] => {
  if (!Array.isArray(rawIds)) return [];
  return Array.from(new Set(
    rawIds
      .filter((value): value is string => typeof value === "string")
      .map((value) => value.trim())
      .filter(Boolean),
  ));
};

export const deleteTodosByIds = async (db: D1Database, userId: string, ids: string[]) => {
  const statements: D1PreparedStatement[] = [];
  for (let index = 0; index < ids.length; index += BULK_DELETE_CHUNK_SIZE) {
    const chunk = ids.slice(index, index + BULK_DELETE_CHUNK_SIZE);
    const placeholders = chunk.map(() => "?").join(",");
    statements.push(db.prepare(`DELETE FROM todos WHERE user_id = ? AND id IN (${placeholders})`).bind(userId, ...chunk));
  }
  if (statements.length) await db.batch(statements);
};

const bulkUpdateTodos = async (
  db: D1Database,
  userId: string,
  ids: string[],
  action: ReturnType<typeof bulkTodoUpdateSchema.parse>["action"],
) => {
  const statements: D1PreparedStatement[] = [];
  const now = nowIso();
  for (let index = 0; index < ids.length; index += BULK_DELETE_CHUNK_SIZE) {
    const chunk = ids.slice(index, index + BULK_DELETE_CHUNK_SIZE);
    const placeholders = chunk.map(() => "?").join(",");
    if (action.type === "PROJECT") {
      statements.push(action.value
        ? db.prepare(`UPDATE todos SET project_id = ?, milestone_id = NULL, parent_todo_id = NULL, updated_at = ? WHERE user_id = ? AND id IN (${placeholders})`).bind(action.value, now, userId, ...chunk)
        : db.prepare(`UPDATE todos SET project_id = NULL, milestone_id = NULL, parent_todo_id = NULL, updated_at = ? WHERE user_id = ? AND id IN (${placeholders})`).bind(now, userId, ...chunk));
    } else if (action.type === "DATE") {
      statements.push(db.prepare(`UPDATE todos SET date = ?, planning_state = 'SCHEDULED', updated_at = ? WHERE user_id = ? AND id IN (${placeholders})`).bind(action.value, now, userId, ...chunk));
    } else if (action.type === "WORKFLOW_STATUS") {
      statements.push(db.prepare(`UPDATE todos SET workflow_status = ?, completed = ?, updated_at = ? WHERE user_id = ? AND id IN (${placeholders})`).bind(action.value, action.value === "DONE" ? 1 : 0, now, userId, ...chunk));
    } else {
      statements.push(db.prepare(`UPDATE todos SET priority = ?, updated_at = ? WHERE user_id = ? AND id IN (${placeholders})`).bind(action.value, now, userId, ...chunk));
    }
  }
  if (statements.length) await db.batch(statements);
};

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

const validatePlanningLinks = async (
  db: ReturnType<typeof drizzle>,
  userId: string,
  input: { projectId?: string | null; milestoneId?: string | null; parentTodoId?: string | null },
  currentTodoId?: string,
) => {
  if (input.projectId) {
    const [project] = await db.select({ id: projects.id }).from(projects).where(and(eq(projects.id, input.projectId), eq(projects.userId, userId))).limit(1);
    if (!project) return "프로젝트를 찾을 수 없습니다.";
  }
  if (input.milestoneId) {
    const [milestone] = await db.select({ id: milestones.id, projectId: milestones.projectId }).from(milestones).where(and(eq(milestones.id, input.milestoneId), eq(milestones.userId, userId))).limit(1);
    if (!milestone) return "마일스톤을 찾을 수 없습니다.";
    if (!input.projectId || milestone.projectId !== input.projectId) return "마일스톤은 선택한 프로젝트에 속해야 합니다.";
  }
  if (input.parentTodoId) {
    if (currentTodoId && input.parentTodoId === currentTodoId) return "Todo는 자기 자신을 상위 Todo로 지정할 수 없습니다.";
    const [parent] = await db.select({ id: todos.id, projectId: todos.projectId }).from(todos).where(and(eq(todos.id, input.parentTodoId), eq(todos.userId, userId))).limit(1);
    if (!parent) return "상위 Todo를 찾을 수 없습니다.";
    if (input.projectId && parent.projectId && parent.projectId !== input.projectId) return "하위 Todo는 상위 Todo와 같은 프로젝트에 속해야 합니다.";
  }
  return "";
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
  const { ids } = await c.req.json<{ ids: string[] }>(); const userId = c.get("userId"); const now = nowIso();
  await c.env.DB.batch(ids.map((id, order) => c.env.DB.prepare("UPDATE categories SET sort_order = ?, updated_at = ? WHERE id = ? AND user_id = ?").bind(order, now, id, userId)));
  return c.json({ ok: true });
});
todoRoutes.get("/categories/:id/todos", async (c) => {
  const db = drizzle(c.env.DB); const page = pagination((name) => c.req.query(name)); const id = c.req.param("id");
  const condition = id === "uncategorized" ? sql`${todos.categoryId} IS NULL` : eq(todos.categoryId, id);
  const rows = await db.select().from(todos).where(and(eq(todos.userId, c.get("userId")), condition)).orderBy(asc(todos.order), desc(todos.createdAt), asc(todos.id)).limit(page.limit).offset(page.offset);
  return c.json({ todos: await serializeTodos(db, rows), nextCursor: page.next(rows.length) });
});
todoRoutes.get("/categories/:id", async (c) => {
  const db = drizzle(c.env.DB); const [row] = await db.select().from(categories).where(and(eq(categories.id, c.req.param("id")), eq(categories.userId, c.get("userId")))).limit(1);
  return row ? c.json({ category: serializeCategory(row) }) : c.json({ message: "카테고리를 찾을 수 없습니다." }, 404);
});
todoRoutes.put("/categories/:id", async (c) => {
  const input = categoryInputSchema.parse(await c.req.json()); const db = drizzle(c.env.DB); const id = c.req.param("id"); const userId = c.get("userId");
  const [existing] = await db.select().from(categories).where(and(eq(categories.id, id), eq(categories.userId, userId))).limit(1); if (!existing) return c.json({ message: "카테고리를 찾을 수 없습니다." }, 404);
  await db.update(categories).set({ name: input.name, description: optional(input.description), color: input.color || "#6366f1", icon: normalizeIcon(input.icon), order: input.order ?? existing.order, updatedAt: nowIso() }).where(eq(categories.id, id));
  const [row] = await db.select().from(categories).where(eq(categories.id, id)); return c.json({ category: serializeCategory(row) });
});
todoRoutes.delete("/categories/:id", async (c) => {
  const db = drizzle(c.env.DB); const id = c.req.param("id"); const userId = c.get("userId");
  const [existing] = await db.select({ id: categories.id }).from(categories).where(and(eq(categories.id, id), eq(categories.userId, userId))).limit(1); if (!existing) return c.json({ message: "카테고리를 찾을 수 없습니다." }, 404);
  if (c.req.query("mode") === "deleteTodos") await db.delete(todos).where(and(eq(todos.userId, userId), eq(todos.categoryId, id)));
  else await db.update(todos).set({ categoryId: null, updatedAt: nowIso() }).where(and(eq(todos.userId, userId), eq(todos.categoryId, id)));
  await db.delete(categories).where(eq(categories.id, id)); return c.json({ ok: true });
});

todoRoutes.get("/todos", async (c) => {
  const db = drizzle(c.env.DB); const userId = c.get("userId"); const page = pagination((name) => c.req.query(name)); const filters = [eq(todos.userId, userId)];
  const categoryId = c.req.query("categoryId"), projectId = c.req.query("projectId"), planningState = c.req.query("planningState"), workflowStatus = c.req.query("workflowStatus");
  const date = c.req.query("date"), from = c.req.query("from"), to = c.req.query("to"), completed = c.req.query("completed"), priority = c.req.query("priority"), archived = c.req.query("archived"), keyword = c.req.query("keyword")?.trim();
  if (categoryId === "uncategorized") filters.push(sql`${todos.categoryId} IS NULL`); else if (categoryId) filters.push(eq(todos.categoryId, categoryId));
  if (projectId) filters.push(eq(todos.projectId, projectId));
  if (planningState === "INBOX" || planningState === "SCHEDULED" || planningState === "SOMEDAY" || planningState === "WAITING") filters.push(eq(todos.planningState, planningState));
  if (workflowStatus === "TODO" || workflowStatus === "IN_PROGRESS" || workflowStatus === "BLOCKED" || workflowStatus === "DONE") filters.push(eq(todos.workflowStatus, workflowStatus));
  if (date) filters.push(eq(todos.date, date)); else { if (from) filters.push(sql`${todos.date} >= ${from}`); if (to) filters.push(sql`${todos.date} <= ${to}`); }
  if (completed === "true" || completed === "false") filters.push(eq(todos.completed, completed === "true"));
  if (priority === "LOW" || priority === "MEDIUM" || priority === "HIGH") filters.push(eq(todos.priority, priority));
  if (archived === "true" || archived === "false") filters.push(eq(todos.archived, archived === "true"));
  if (keyword) {
    const pattern = `%${keyword}%`;
    filters.push(or(
      like(todos.title, pattern), like(todos.memo, pattern),
      sql`EXISTS (SELECT 1 FROM categories AS search_category WHERE search_category.id = ${todos.categoryId} AND search_category.name LIKE ${pattern})`,
      sql`EXISTS (SELECT 1 FROM todo_tags AS search_todo_tag INNER JOIN tags AS search_tag ON search_tag.id = search_todo_tag.tag_id WHERE search_todo_tag.todo_id = ${todos.id} AND search_tag.name LIKE ${pattern})`,
    )!);
  }
  const rows = await db.select().from(todos).where(and(...filters)).orderBy(asc(todos.order), desc(todos.createdAt), asc(todos.id)).limit(page.limit).offset(page.offset);
  return c.json({ todos: await serializeTodos(db, rows), nextCursor: page.next(rows.length) });
});

todoRoutes.post("/todos", async (c) => {
  const input = todoInputSchema.parse(await c.req.json()); const db = drizzle(c.env.DB); const userId = c.get("userId");
  if (input.categoryId) { const [category] = await db.select({ id: categories.id }).from(categories).where(and(eq(categories.id, input.categoryId), eq(categories.userId, userId))); if (!category) return c.json({ message: "카테고리를 찾을 수 없습니다." }, 400); }
  const linkError = await validatePlanningLinks(db, userId, input); if (linkError) return c.json({ message: linkError }, 400);
  const [maximum] = await db.select({ value: max(todos.order) }).from(todos).where(and(eq(todos.userId, userId), input.categoryId ? eq(todos.categoryId, input.categoryId) : sql`${todos.categoryId} IS NULL`)); const now = nowIso();
  const completed = input.completed || input.workflowStatus === "DONE";
  const row = {
    id: newId(), userId, categoryId: input.categoryId || null, projectId: input.projectId || null, milestoneId: input.milestoneId || null, parentTodoId: input.parentTodoId || null,
    title: input.title, memo: optional(input.memo), date: input.date, dueDate: optional(input.dueDate), startTime: optional(input.startTime), endTime: optional(input.endTime), estimateMinutes: input.estimateMinutes ?? null,
    planningState: input.planningState, workflowStatus: completed ? "DONE" as const : input.workflowStatus, priority: input.priority, completed,
    repeat: input.repeat, archived: input.archived || false, archivedAt: input.archived ? now : null, order: input.order ?? (maximum.value ?? -1) + 1, createdAt: now, updatedAt: now,
  };
  await db.insert(todos).values(row); await syncTags(db, userId, row.id, input.tags); return c.json({ todo: (await serializeTodos(db, [row]))[0] }, 201);
});

todoRoutes.post("/todos/bulk-delete", async (c) => {
  const { ids: rawIds } = await c.req.json<{ ids?: unknown }>(); const ids = normalizeBulkTodoIds(rawIds);
  if (!ids.length) return c.json({ message: "삭제할 Todo를 선택해주세요." }, 400);
  if (ids.length > MAX_BULK_DELETE_IDS) return c.json({ message: `한 번에 최대 ${MAX_BULK_DELETE_IDS}개의 Todo를 삭제할 수 있습니다.` }, 400);
  await deleteTodosByIds(c.env.DB, c.get("userId"), ids); return c.json({ ok: true });
});

todoRoutes.post("/todos/bulk-update", async (c) => {
  const input = bulkTodoUpdateSchema.parse(await c.req.json()); const ids = normalizeBulkTodoIds(input.ids); const userId = c.get("userId");
  if (!ids.length) return c.json({ message: "변경할 Todo를 선택해주세요." }, 400);
  if (ids.length > MAX_BULK_DELETE_IDS) return c.json({ message: `한 번에 최대 ${MAX_BULK_DELETE_IDS}개의 Todo를 변경할 수 있습니다.` }, 400);
  if (input.action.type === "PROJECT" && input.action.value) {
    const db = drizzle(c.env.DB); const [project] = await db.select({ id: projects.id }).from(projects).where(and(eq(projects.id, input.action.value), eq(projects.userId, userId))).limit(1);
    if (!project) return c.json({ message: "프로젝트를 찾을 수 없습니다." }, 400);
  }
  await bulkUpdateTodos(c.env.DB, userId, ids, input.action); return c.json({ ok: true, updated: ids.length });
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
  const linkError = await validatePlanningLinks(db, userId, input, id); if (linkError) return c.json({ message: linkError }, 400);
  const completed = input.completed ?? (input.workflowStatus === "DONE");
  const workflowStatus = completed ? "DONE" as const : input.workflowStatus === "DONE" ? "TODO" as const : input.workflowStatus;
  await db.update(todos).set({
    categoryId: input.categoryId || null, projectId: input.projectId || null, milestoneId: input.milestoneId || null, parentTodoId: input.parentTodoId || null,
    title: input.title, memo: optional(input.memo), date: input.date, dueDate: optional(input.dueDate), startTime: optional(input.startTime), endTime: optional(input.endTime), estimateMinutes: input.estimateMinutes ?? null,
    planningState: input.planningState, workflowStatus, priority: input.priority, completed, repeat: input.repeat,
    archived: input.archived ?? existing.archived, archivedAt: input.archived === true && !existing.archived ? nowIso() : input.archived === false ? null : existing.archivedAt,
    order: input.order ?? existing.order, updatedAt: nowIso(),
  }).where(eq(todos.id, id));
  await syncTags(db, userId, id, input.tags); const [row] = await db.select().from(todos).where(eq(todos.id, id)); return c.json({ todo: (await serializeTodos(db, [row]))[0] });
});
todoRoutes.delete("/todos/:id", async (c) => { const db = drizzle(c.env.DB); await db.delete(todos).where(and(eq(todos.id, c.req.param("id")), eq(todos.userId, c.get("userId")))); return c.json({ ok: true }); });

for (const action of ["toggle", "archive", "unarchive"] as const) todoRoutes.patch(`/todos/:id/${action}`, async (c) => {
  const db = drizzle(c.env.DB); const id = c.req.param("id"), userId = c.get("userId"); const [existing] = await db.select().from(todos).where(and(eq(todos.id, id), eq(todos.userId, userId))).limit(1);
  if (!existing) return c.json({ message: "Todo를 찾을 수 없습니다." }, 404);
  const update = action === "toggle"
    ? { completed: !existing.completed, workflowStatus: !existing.completed ? "DONE" as const : existing.workflowStatus === "DONE" ? "TODO" as const : existing.workflowStatus }
    : action === "archive" ? { archived: true, archivedAt: nowIso() } : { archived: false, archivedAt: null };
  await db.update(todos).set({ ...update, updatedAt: nowIso() }).where(eq(todos.id, id)); const [row] = await db.select().from(todos).where(eq(todos.id, id)); return c.json({ todo: (await serializeTodos(db, [row]))[0] });
});
