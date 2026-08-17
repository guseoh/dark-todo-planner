import { Hono } from "hono";
import { routineRunSchema, routineTemplateSchema } from "../step4Validation";
import type { Bindings, Variables } from "../types";
import { newId, nowIso } from "../utils";

export const routineRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>();

type RoutineItemRow = {
  routineId: string;
  routineName: string;
  routineDescription: string | null;
  routineCreatedAt: string;
  routineUpdatedAt: string;
  lastRunDate: string | null;
  itemId: string | null;
  title: string | null;
  priority: "LOW" | "MEDIUM" | "HIGH" | null;
  estimateMinutes: number | null;
  projectId: string | null;
  categoryId: string | null;
  sortOrder: number | null;
};

const listRoutines = async (db: D1Database, userId: string) => {
  const result = await db.prepare(`
    SELECT r.id AS routineId, r.name AS routineName, r.description AS routineDescription,
      r.created_at AS routineCreatedAt, r.updated_at AS routineUpdatedAt,
      (SELECT MAX(rr.target_date) FROM routine_runs rr WHERE rr.routine_id = r.id) AS lastRunDate,
      i.id AS itemId, i.title, i.priority, i.estimate_minutes AS estimateMinutes,
      i.project_id AS projectId, i.category_id AS categoryId, i.sort_order AS sortOrder
    FROM routine_templates r
    LEFT JOIN routine_template_items i ON i.routine_id = r.id
    WHERE r.user_id = ?
    ORDER BY r.updated_at DESC, i.sort_order ASC, i.created_at ASC
  `).bind(userId).all<RoutineItemRow>();
  const map = new Map<string, { id: string; name: string; description: string | null; lastRunDate: string | null; createdAt: string; updatedAt: string; items: unknown[] }>();
  for (const row of result.results) {
    const routine = map.get(row.routineId) || {
      id: row.routineId,
      name: row.routineName,
      description: row.routineDescription,
      lastRunDate: row.lastRunDate,
      createdAt: row.routineCreatedAt,
      updatedAt: row.routineUpdatedAt,
      items: [],
    };
    if (row.itemId && row.title && row.priority) routine.items.push({
      id: row.itemId,
      title: row.title,
      priority: row.priority,
      estimateMinutes: row.estimateMinutes,
      projectId: row.projectId,
      categoryId: row.categoryId,
      order: row.sortOrder ?? routine.items.length,
    });
    map.set(row.routineId, routine);
  }
  return [...map.values()];
};

const findRoutine = (db: D1Database, userId: string, id: string) => db.prepare("SELECT id FROM routine_templates WHERE id = ? AND user_id = ? LIMIT 1").bind(id, userId).first<{ id: string }>();

const normalizedId = (value: string | null | undefined) => value?.trim() || null;

const ensureReferences = async (db: D1Database, userId: string, items: Array<{ projectId?: string | null; categoryId?: string | null }>) => {
  const projectIds = [...new Set(items.map((item) => normalizedId(item.projectId)).filter((value): value is string => Boolean(value)))];
  const categoryIds = [...new Set(items.map((item) => normalizedId(item.categoryId)).filter((value): value is string => Boolean(value)))];
  if (projectIds.length) {
    const placeholders = projectIds.map(() => "?").join(",");
    const found = await db.prepare(`SELECT id FROM projects WHERE user_id = ? AND id IN (${placeholders})`).bind(userId, ...projectIds).all<{ id: string }>();
    if (found.results.length !== projectIds.length) throw new Error("ROUTINE_PROJECT_NOT_FOUND");
  }
  if (categoryIds.length) {
    const placeholders = categoryIds.map(() => "?").join(",");
    const found = await db.prepare(`SELECT id FROM categories WHERE user_id = ? AND id IN (${placeholders})`).bind(userId, ...categoryIds).all<{ id: string }>();
    if (found.results.length !== categoryIds.length) throw new Error("ROUTINE_CATEGORY_NOT_FOUND");
  }
};

routineRoutes.get("/routines", async (c) => c.json({ routines: await listRoutines(c.env.DB, c.get("userId")) }));

routineRoutes.post("/routines", async (c) => {
  const input = routineTemplateSchema.parse(await c.req.json());
  const userId = c.get("userId");
  try { await ensureReferences(c.env.DB, userId, input.items); } catch { return c.json({ message: "루틴 항목의 프로젝트 또는 카테고리를 찾을 수 없습니다." }, 400); }
  const id = newId();
  const now = nowIso();
  await c.env.DB.batch([
    c.env.DB.prepare("INSERT INTO routine_templates (id, user_id, name, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)").bind(id, userId, input.name, input.description?.trim() || null, now, now),
    ...input.items.map((item, index) => c.env.DB.prepare(`
      INSERT INTO routine_template_items (id, routine_id, title, priority, estimate_minutes, project_id, category_id, sort_order, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(newId(), id, item.title, item.priority, item.estimateMinutes ?? null, normalizedId(item.projectId), normalizedId(item.categoryId), index, now, now)),
  ]);
  return c.json({ routines: await listRoutines(c.env.DB, userId) }, 201);
});

routineRoutes.put("/routines/:id", async (c) => {
  const id = c.req.param("id");
  const userId = c.get("userId");
  if (!await findRoutine(c.env.DB, userId, id)) return c.json({ message: "루틴을 찾을 수 없습니다." }, 404);
  const input = routineTemplateSchema.parse(await c.req.json());
  try { await ensureReferences(c.env.DB, userId, input.items); } catch { return c.json({ message: "루틴 항목의 프로젝트 또는 카테고리를 찾을 수 없습니다." }, 400); }
  const now = nowIso();
  await c.env.DB.batch([
    c.env.DB.prepare("UPDATE routine_templates SET name = ?, description = ?, updated_at = ? WHERE id = ? AND user_id = ?").bind(input.name, input.description?.trim() || null, now, id, userId),
    c.env.DB.prepare("DELETE FROM routine_template_items WHERE routine_id = ?").bind(id),
    ...input.items.map((item, index) => c.env.DB.prepare(`
      INSERT INTO routine_template_items (id, routine_id, title, priority, estimate_minutes, project_id, category_id, sort_order, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(newId(), id, item.title, item.priority, item.estimateMinutes ?? null, normalizedId(item.projectId), normalizedId(item.categoryId), index, now, now)),
  ]);
  return c.json({ routines: await listRoutines(c.env.DB, userId) });
});

routineRoutes.delete("/routines/:id", async (c) => {
  const id = c.req.param("id");
  const userId = c.get("userId");
  if (!await findRoutine(c.env.DB, userId, id)) return c.json({ message: "루틴을 찾을 수 없습니다." }, 404);
  await c.env.DB.prepare("DELETE FROM routine_templates WHERE id = ? AND user_id = ?").bind(id, userId).run();
  return c.json({ ok: true });
});

routineRoutes.post("/routines/:id/run", async (c) => {
  const id = c.req.param("id");
  const userId = c.get("userId");
  if (!await findRoutine(c.env.DB, userId, id)) return c.json({ message: "루틴을 찾을 수 없습니다." }, 404);
  const { targetDate } = routineRunSchema.parse(await c.req.json());
  const existing = await c.env.DB.prepare("SELECT id FROM routine_runs WHERE routine_id = ? AND target_date = ? LIMIT 1").bind(id, targetDate).first<{ id: string }>();
  if (existing) return c.json({ message: "이 루틴은 해당 날짜에 이미 생성했습니다." }, 409);
  const items = await c.env.DB.prepare(`
    SELECT title, priority, estimate_minutes AS estimateMinutes, project_id AS projectId, category_id AS categoryId
    FROM routine_template_items WHERE routine_id = ? ORDER BY sort_order ASC, created_at ASC
  `).bind(id).all<{ title: string; priority: "LOW" | "MEDIUM" | "HIGH"; estimateMinutes: number | null; projectId: string | null; categoryId: string | null }>();
  if (!items.results.length) return c.json({ message: "루틴에 생성할 항목이 없습니다." }, 409);
  const maximum = await c.env.DB.prepare("SELECT COALESCE(MAX(sort_order), -1) AS value FROM todos WHERE user_id = ?").bind(userId).first<{ value: number }>();
  const now = nowIso();
  const runId = newId();
  try {
    await c.env.DB.batch([
      c.env.DB.prepare("INSERT INTO routine_runs (id, routine_id, target_date, created_at) VALUES (?, ?, ?, ?)").bind(runId, id, targetDate, now),
      ...items.results.map((item, index) => c.env.DB.prepare(`
        INSERT INTO todos (
          id, user_id, category_id, project_id, milestone_id, parent_todo_id, title, memo, reference_url, reference_label,
          date, due_date, start_time, end_time, estimate_minutes, planning_state, workflow_status, priority, completed, repeat,
          archived, archived_at, sort_order, created_at, updated_at
        ) VALUES (?, ?, ?, ?, NULL, NULL, ?, NULL, NULL, NULL, ?, NULL, NULL, NULL, ?, 'SCHEDULED', 'TODO', ?, 0, 'NONE', 0, NULL, ?, ?, ?)
      `).bind(newId(), userId, item.categoryId, item.projectId, item.title, targetDate, item.estimateMinutes, item.priority, (maximum?.value ?? -1) + index + 1, now, now)),
    ]);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("routine_runs") || message.includes("UNIQUE")) return c.json({ message: "이 루틴은 해당 날짜에 이미 생성했습니다." }, 409);
    throw error;
  }
  return c.json({ created: true, runId, todoCount: items.results.length, targetDate }, 201);
});
