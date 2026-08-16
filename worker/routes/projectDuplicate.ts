import { and, asc, eq, max } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { Hono } from "hono";
import { z } from "zod";
import { milestones, projects, todos } from "../db/schema";
import type { Bindings, Variables } from "../types";
import { newId, nowIso } from "../utils";

const duplicateProjectSchema = z.object({
  name: z.string().trim().min(1).max(120),
  mode: z.enum(["STRUCTURE", "WITH_TODOS"]).default("STRUCTURE"),
});

const UNSCHEDULED_DATE = "9999-12-31";
const TAG_COPY_BATCH_SIZE = 40;

const parseResources = (value?: string | null) => {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const projectDuplicateRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>();

projectDuplicateRoutes.post("/projects/:id/duplicate", async (c) => {
  const input = duplicateProjectSchema.parse(await c.req.json());
  const db = drizzle(c.env.DB);
  const userId = c.get("userId");
  const sourceId = c.req.param("id");

  const [source] = await db.select().from(projects).where(and(eq(projects.id, sourceId), eq(projects.userId, userId))).limit(1);
  if (!source) return c.json({ message: "프로젝트를 찾을 수 없습니다." }, 404);

  const [maximum, sourceMilestones, resourceRow] = await Promise.all([
    db.select({ value: max(projects.order) }).from(projects).where(eq(projects.userId, userId)).then((rows) => rows[0]),
    db.select().from(milestones).where(and(eq(milestones.userId, userId), eq(milestones.projectId, sourceId))).orderBy(asc(milestones.order), asc(milestones.createdAt)),
    c.env.DB.prepare("SELECT resources_json FROM projects WHERE id = ? AND user_id = ?").bind(sourceId, userId).first<{ resources_json: string | null }>(),
  ]);

  const now = nowIso();
  const projectId = newId();
  const projectRow = {
    id: projectId,
    userId,
    name: input.name,
    description: source.description,
    status: "PLANNING" as const,
    color: source.color,
    icon: source.icon,
    startDate: null,
    targetDate: null,
    archived: false,
    archivedAt: null,
    order: (maximum?.value ?? -1) + 1,
    createdAt: now,
    updatedAt: now,
  };

  await db.insert(projects).values(projectRow);
  const resourcesJson = resourceRow?.resources_json || "[]";
  await c.env.DB.prepare("UPDATE projects SET resources_json = ? WHERE id = ? AND user_id = ?").bind(resourcesJson, projectId, userId).run();

  const milestoneIdMap = new Map(sourceMilestones.map((milestone) => [milestone.id, newId()]));
  const milestoneRows = sourceMilestones.map((milestone) => ({
    id: milestoneIdMap.get(milestone.id)!,
    userId,
    projectId,
    title: milestone.title,
    description: milestone.description,
    targetDate: null,
    status: "TODO" as const,
    order: milestone.order,
    createdAt: now,
    updatedAt: now,
  }));
  if (milestoneRows.length) await db.insert(milestones).values(milestoneRows);

  let copiedTodoCount = 0;
  if (input.mode === "WITH_TODOS") {
    const sourceTodos = await db.select().from(todos)
      .where(and(eq(todos.userId, userId), eq(todos.projectId, sourceId), eq(todos.archived, false)))
      .orderBy(asc(todos.order), asc(todos.createdAt));
    const todoIdMap = new Map(sourceTodos.map((todo) => [todo.id, newId()]));
    const todoRows = sourceTodos.map((todo) => ({
      id: todoIdMap.get(todo.id)!,
      userId,
      categoryId: todo.categoryId,
      projectId,
      milestoneId: todo.milestoneId ? milestoneIdMap.get(todo.milestoneId) || null : null,
      parentTodoId: todo.parentTodoId ? todoIdMap.get(todo.parentTodoId) || null : null,
      title: todo.title,
      memo: todo.memo,
      referenceUrl: todo.referenceUrl,
      referenceLabel: todo.referenceLabel,
      date: UNSCHEDULED_DATE,
      dueDate: null,
      startTime: null,
      endTime: null,
      estimateMinutes: todo.estimateMinutes,
      planningState: "INBOX" as const,
      workflowStatus: "TODO" as const,
      priority: todo.priority,
      completed: false,
      repeat: "NONE" as const,
      archived: false,
      archivedAt: null,
      order: todo.order,
      createdAt: now,
      updatedAt: now,
    }));
    if (todoRows.length) await db.insert(todos).values(todoRows);
    copiedTodoCount = todoRows.length;

    const tagCopyStatements = sourceTodos.map((todo) => c.env.DB.prepare(
      "INSERT INTO todo_tags (todo_id, tag_id) SELECT ?, tag_id FROM todo_tags WHERE todo_id = ?",
    ).bind(todoIdMap.get(todo.id)!, todo.id));
    for (let index = 0; index < tagCopyStatements.length; index += TAG_COPY_BATCH_SIZE) {
      await c.env.DB.batch(tagCopyStatements.slice(index, index + TAG_COPY_BATCH_SIZE));
    }
  }

  return c.json({
    project: { ...projectRow, resources: parseResources(resourcesJson) },
    milestoneCount: milestoneRows.length,
    todoCount: copiedTodoCount,
  }, 201);
});
