import { and, eq, max, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { Hono } from "hono";
import { z } from "zod";
import { categories, milestones, projects, tags, todoTags, todos } from "../db/schema";
import { serializeTodos } from "../serializers";
import type { Bindings, Variables } from "../types";
import { newId, nowIso, optional } from "../utils";
import { todoInputSchema } from "../validation";

export const offlineTodoRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>();
const todoIdSchema = z.string().uuid();

const validateLinks = async (
  db: ReturnType<typeof drizzle>,
  userId: string,
  input: { categoryId?: string | null; projectId?: string | null; milestoneId?: string | null; parentTodoId?: string | null },
) => {
  if (input.categoryId) {
    const [category] = await db.select({ id: categories.id }).from(categories).where(and(eq(categories.id, input.categoryId), eq(categories.userId, userId))).limit(1);
    if (!category) return "카테고리를 찾을 수 없습니다.";
  }
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
    const [parent] = await db.select({ id: todos.id, projectId: todos.projectId }).from(todos).where(and(eq(todos.id, input.parentTodoId), eq(todos.userId, userId))).limit(1);
    if (!parent) return "상위 Todo를 찾을 수 없습니다.";
    if (input.projectId && parent.projectId && parent.projectId !== input.projectId) return "하위 Todo는 상위 Todo와 같은 프로젝트에 속해야 합니다.";
  }
  return "";
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

offlineTodoRoutes.put("/offline/todos/:id", async (c) => {
  const parsedId = todoIdSchema.safeParse(c.req.param("id"));
  if (!parsedId.success) return c.json({ message: "Todo 동기화 ID가 올바르지 않습니다." }, 400);
  const input = todoInputSchema.parse(await c.req.json());
  const db = drizzle(c.env.DB);
  const userId = c.get("userId");
  const id = parsedId.data;

  const [existingById] = await db.select().from(todos).where(eq(todos.id, id)).limit(1);
  if (existingById) {
    if (existingById.userId !== userId) return c.json({ message: "Todo 동기화 ID가 충돌했습니다." }, 409);
    return c.json({ todo: (await serializeTodos(db, [existingById]))[0] });
  }

  const linkError = await validateLinks(db, userId, input);
  if (linkError) return c.json({ message: linkError }, 400);

  const [maximum] = await db.select({ value: max(todos.order) }).from(todos).where(and(
    eq(todos.userId, userId),
    input.categoryId ? eq(todos.categoryId, input.categoryId) : sql`${todos.categoryId} IS NULL`,
  ));
  const now = nowIso();
  const completed = input.completed || input.workflowStatus === "DONE";
  const row = {
    id,
    userId,
    categoryId: input.categoryId || null,
    projectId: input.projectId || null,
    milestoneId: input.milestoneId || null,
    parentTodoId: input.parentTodoId || null,
    title: input.title,
    memo: optional(input.memo),
    date: input.date,
    dueDate: optional(input.dueDate),
    startTime: optional(input.startTime),
    endTime: optional(input.endTime),
    estimateMinutes: input.estimateMinutes ?? null,
    planningState: input.planningState,
    workflowStatus: completed ? "DONE" as const : input.workflowStatus,
    priority: input.priority,
    completed,
    repeat: input.repeat,
    archived: input.archived || false,
    archivedAt: input.archived ? now : null,
    order: input.order ?? (maximum.value ?? -1) + 1,
    createdAt: now,
    updatedAt: now,
  };
  await db.insert(todos).values(row);
  await syncTags(db, userId, id, input.tags);
  return c.json({ todo: (await serializeTodos(db, [row]))[0] }, 201);
});
