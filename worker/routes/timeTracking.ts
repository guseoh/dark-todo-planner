import { Hono } from "hono";
import { z } from "zod";
import { finalizeRange, plannerDateOf, splitByPlannerDay, type SessionSegment } from "../timeSplit";
import type { Bindings, Variables } from "../types";
import { newId, nowIso, optional } from "../utils";

/**
 * Time tracking. A running timer is a single active_timers row; stopping it writes
 * focus_sessions rows (mode FOCUS), one per planner day, with a snapshot of the
 * Todo title, category and project so history survives later edits and deletions.
 */
export const timeTrackingRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>();

const MAX_ENTRY_MS = 24 * 3_600_000;
const dateKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const isoInstant = z.iso.datetime({ offset: true });

// A timer runs on one Todo, on a whole category, or on a project (optionally tagged with a category).
const startSchema = z.union([
  z.object({ todoId: z.string().min(1) }),
  z.object({ projectId: z.string().min(1), categoryId: z.string().min(1).nullable().optional() }),
  z.object({ categoryId: z.string().min(1) }),
]);
const rangeSchema = z.object({ from: dateKey, to: dateKey });
const entryTimesSchema = z.object({ startedAt: isoInstant, endedAt: isoInstant });
const createEntrySchema = entryTimesSchema.extend({
  todoId: z.string().min(1).nullable().optional(),
  projectId: z.string().min(1).nullable().optional(),
  title: z.string().trim().min(1).max(200).optional(),
  categoryId: z.string().min(1).nullable().optional(),
});
const updateEntrySchema = entryTimesSchema.extend({
  title: z.string().trim().min(1).max(200).optional(),
  categoryId: z.string().min(1).nullable().optional(),
});

type ActiveRow = { todo_id: string | null; todo_title: string; category_id: string | null; category_name: string | null; project_id: string | null; started_at: string };
type EntryRow = {
  id: string; todo_id: string | null; todo_title: string | null; category_id: string | null; category_name: string | null;
  project_id: string | null; planner_date: string; started_at: string; ended_at: string; duration_minutes: number;
};
type Meta = { todoId: string | null; title: string; categoryId: string | null; categoryName: string | null; projectId: string | null };

const serializeActive = (row: ActiveRow) => ({
  todoId: row.todo_id ?? undefined, todoTitle: row.todo_title, categoryId: row.category_id ?? undefined,
  categoryName: row.category_name ?? undefined, projectId: row.project_id ?? undefined, startedAt: row.started_at,
});
const serializeEntry = (row: EntryRow) => ({
  id: row.id, todoId: row.todo_id ?? undefined, title: row.todo_title ?? "제목 없음", categoryId: row.category_id ?? undefined,
  categoryName: row.category_name ?? undefined, projectId: row.project_id ?? undefined, plannerDate: row.planner_date,
  startedAt: row.started_at, endedAt: row.ended_at, durationMinutes: row.duration_minutes,
});

const getActive = (db: D1Database, userId: string) =>
  db.prepare("SELECT todo_id, todo_title, category_id, category_name, project_id, started_at FROM active_timers WHERE user_id = ?").bind(userId).first<ActiveRow>();

const todoMeta = async (db: D1Database, userId: string, todoId: string) => {
  const row = await db.prepare(
    "SELECT t.id, t.title, t.archived, t.category_id, c.name AS category_name, t.project_id FROM todos t LEFT JOIN categories c ON c.id = t.category_id AND c.user_id = t.user_id WHERE t.id = ? AND t.user_id = ?",
  ).bind(todoId, userId).first<{ id: string; title: string; archived: number; category_id: string | null; category_name: string | null; project_id: string | null }>();
  return row ?? undefined;
};
const categoryName = (db: D1Database, userId: string, categoryId: string) =>
  db.prepare("SELECT name FROM categories WHERE id = ? AND user_id = ?").bind(categoryId, userId).first<{ name: string }>();
const projectMeta = (db: D1Database, userId: string, projectId: string) =>
  db.prepare("SELECT name, archived FROM projects WHERE id = ? AND user_id = ?").bind(projectId, userId).first<{ name: string; archived: number }>();

type Target = { todoId: string | null; title: string; categoryId: string | null; categoryName: string | null; projectId: string | null };
type Resolved = { target: Target } | { error: { message: string; status: 400 | 404 } };

/** Turns a start request into the snapshot stored on the running timer. */
const resolveTarget = async (db: D1Database, userId: string, input: z.infer<typeof startSchema>): Promise<Resolved> => {
  if ("todoId" in input) {
    const todo = await todoMeta(db, userId, input.todoId);
    if (!todo) return { error: { message: "Todo를 찾을 수 없습니다.", status: 404 } };
    if (todo.archived) return { error: { message: "보관된 Todo는 측정할 수 없습니다.", status: 400 } };
    return { target: { todoId: todo.id, title: todo.title, categoryId: todo.category_id, categoryName: todo.category_name, projectId: todo.project_id } };
  }
  if ("projectId" in input) {
    const project = await projectMeta(db, userId, input.projectId);
    if (!project) return { error: { message: "프로젝트를 찾을 수 없습니다.", status: 404 } };
    if (project.archived) return { error: { message: "보관된 프로젝트는 측정할 수 없습니다.", status: 400 } };
    const category = input.categoryId ? await categoryName(db, userId, input.categoryId) : null;
    return { target: { todoId: null, title: project.name, categoryId: category ? input.categoryId ?? null : null, categoryName: category?.name ?? null, projectId: input.projectId } };
  }
  const category = await categoryName(db, userId, input.categoryId);
  if (!category) return { error: { message: "카테고리를 찾을 수 없습니다.", status: 404 } };
  return { target: { todoId: null, title: category.name, categoryId: input.categoryId, categoryName: category.name, projectId: null } };
};

const sameTarget = (active: ActiveRow, target: Target) =>
  active.todo_id === target.todoId && active.project_id === target.projectId && (target.todoId !== null || active.category_id === target.categoryId);

const insertSegments = (db: D1Database, userId: string, meta: Meta, segments: SessionSegment[], createdAt: string) => {
  const ids = segments.map(() => newId());
  const statements = segments.map((segment, index) => db.prepare(
    "INSERT INTO focus_sessions (id, user_id, todo_id, todo_title, mode, duration_minutes, planner_date, started_at, ended_at, completed, category_id, category_name, project_id, created_at) VALUES (?, ?, ?, ?, 'FOCUS', ?, ?, ?, ?, 1, ?, ?, ?, ?)",
  ).bind(ids[index], userId, meta.todoId, meta.title, segment.durationMinutes, segment.plannerDate, segment.startedAt, segment.endedAt, meta.categoryId, meta.categoryName, meta.projectId, createdAt));
  return { ids, statements };
};

const activeMeta = (row: ActiveRow): Meta => ({ todoId: row.todo_id, title: row.todo_title, categoryId: row.category_id, categoryName: row.category_name, projectId: row.project_id });

const loadEntries = async (db: D1Database, userId: string, ids: string[]) => {
  if (!ids.length) return [];
  const { results } = await db.prepare(
    `SELECT id, todo_id, todo_title, category_id, category_name, project_id, planner_date, started_at, ended_at, duration_minutes FROM focus_sessions WHERE user_id = ? AND id IN (${ids.map(() => "?").join(",")}) ORDER BY started_at`,
  ).bind(userId, ...ids).all<EntryRow>();
  return results.map(serializeEntry);
};

timeTrackingRoutes.get("/timer", async (c) => {
  const row = await getActive(c.env.DB, c.get("userId"));
  return c.json({ activeTimer: row ? serializeActive(row) : null, serverNow: nowIso() });
});

timeTrackingRoutes.post("/timer/start", async (c) => {
  const input = startSchema.parse(await c.req.json());
  const userId = c.get("userId"); const db = c.env.DB;
  const resolved = await resolveTarget(db, userId, input);
  if ("error" in resolved) return c.json({ message: resolved.error.message }, resolved.error.status);
  const { target } = resolved;
  const active = await getActive(db, userId);
  if (active && sameTarget(active, target)) return c.json({ activeTimer: serializeActive(active), serverNow: nowIso(), stopped: [] });

  const nowMs = Date.now(); const now = new Date(nowMs).toISOString();
  const statements: D1PreparedStatement[] = [];
  let stoppedIds: string[] = [];
  if (active) {
    // Switching tasks finishes the previous timer instead of running two at once.
    const finished = finalizeRange(Date.parse(active.started_at), nowMs);
    const inserted = insertSegments(db, userId, activeMeta(active), finished.segments, now);
    statements.push(...inserted.statements);
    stoppedIds = inserted.ids;
  }
  statements.push(db.prepare(
    "INSERT INTO active_timers (user_id, todo_id, todo_title, category_id, category_name, project_id, started_at) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET todo_id = excluded.todo_id, todo_title = excluded.todo_title, category_id = excluded.category_id, category_name = excluded.category_name, project_id = excluded.project_id, started_at = excluded.started_at",
  ).bind(userId, target.todoId, target.title, target.categoryId, target.categoryName, target.projectId, now));
  await db.batch(statements);
  return c.json({
    activeTimer: serializeActive({ todo_id: target.todoId, todo_title: target.title, category_id: target.categoryId, category_name: target.categoryName, project_id: target.projectId, started_at: now }),
    serverNow: now, switchedFrom: active ? serializeActive(active) : undefined,
    timeEntries: await loadEntries(db, userId, stoppedIds),
  });
});

timeTrackingRoutes.post("/timer/stop", async (c) => {
  const userId = c.get("userId"); const db = c.env.DB;
  const active = await getActive(db, userId);
  if (!active) return c.json({ activeTimer: null, timeEntries: [], serverNow: nowIso() });
  const nowMs = Date.now(); const now = new Date(nowMs).toISOString();
  const finished = finalizeRange(Date.parse(active.started_at), nowMs);
  const inserted = insertSegments(db, userId, activeMeta(active), finished.segments, now);
  await db.batch([...inserted.statements, db.prepare("DELETE FROM active_timers WHERE user_id = ?").bind(userId)]);
  return c.json({ activeTimer: null, timeEntries: await loadEntries(db, userId, inserted.ids), capped: finished.capped, discarded: finished.discarded, serverNow: now });
});

timeTrackingRoutes.get("/time-entries", async (c) => {
  const { from, to } = rangeSchema.parse({ from: c.req.query("from"), to: c.req.query("to") });
  const { results } = await c.env.DB.prepare(
    "SELECT id, todo_id, todo_title, category_id, category_name, project_id, planner_date, started_at, ended_at, duration_minutes FROM focus_sessions WHERE user_id = ? AND mode = 'FOCUS' AND planner_date >= ? AND planner_date <= ? ORDER BY started_at LIMIT 2000",
  ).bind(c.get("userId"), from, to).all<EntryRow>();
  return c.json({ timeEntries: results.map(serializeEntry) });
});

const validateTimes = (startedAt: string, endedAt: string) => {
  const start = Date.parse(startedAt); const end = Date.parse(endedAt);
  if (!(end > start)) return "종료 시각은 시작 시각보다 뒤여야 합니다.";
  if (end - start > MAX_ENTRY_MS) return "한 기록은 24시간을 넘을 수 없습니다.";
  if (end > Date.now() + 60_000) return "미래 시각은 기록할 수 없습니다.";
  return "";
};

timeTrackingRoutes.post("/time-entries", async (c) => {
  const input = createEntrySchema.parse(await c.req.json());
  const userId = c.get("userId"); const db = c.env.DB;
  const problem = validateTimes(input.startedAt, input.endedAt);
  if (problem) return c.json({ message: problem }, 400);
  let meta: Meta;
  if (input.todoId && input.projectId) return c.json({ message: "Todo 또는 프로젝트 중 한 대상을 선택하세요." }, 400);
  if (input.todoId) {
    const todo = await todoMeta(db, userId, input.todoId);
    if (!todo) return c.json({ message: "Todo를 찾을 수 없습니다." }, 404);
    meta = { todoId: todo.id, title: todo.title, categoryId: todo.category_id, categoryName: todo.category_name, projectId: todo.project_id };
  } else {
    const project = input.projectId ? await projectMeta(db, userId, input.projectId) : null;
    if (input.projectId && !project) return c.json({ message: "프로젝트를 찾을 수 없습니다." }, 404);
    if (project?.archived) return c.json({ message: "보관된 프로젝트에는 새 기록을 추가할 수 없습니다." }, 400);
    const title = input.title ?? project?.name;
    if (!title) return c.json({ message: "Todo를 고르거나 제목을 입력하세요." }, 400);
    let name: string | null = null;
    if (input.categoryId) {
      const category = await categoryName(db, userId, input.categoryId);
      if (!category) return c.json({ message: "카테고리를 찾을 수 없습니다." }, 404);
      name = category.name;
    }
    meta = { todoId: null, title, categoryId: input.categoryId ?? null, categoryName: name, projectId: input.projectId ?? null };
  }
  const now = nowIso();
  const segments = splitByPlannerDay(Date.parse(input.startedAt), Date.parse(input.endedAt));
  const inserted = insertSegments(db, userId, meta, segments, now);
  await db.batch(inserted.statements);
  return c.json({ timeEntries: await loadEntries(db, userId, inserted.ids) }, 201);
});

timeTrackingRoutes.put("/time-entries/:id", async (c) => {
  const input = updateEntrySchema.parse(await c.req.json());
  const userId = c.get("userId"); const db = c.env.DB; const id = c.req.param("id");
  const existing = await db.prepare("SELECT id, todo_title, category_id, category_name FROM focus_sessions WHERE id = ? AND user_id = ? AND mode = 'FOCUS'").bind(id, userId).first<{ id: string; todo_title: string | null; category_id: string | null; category_name: string | null }>();
  if (!existing) return c.json({ message: "기록을 찾을 수 없습니다." }, 404);
  const problem = validateTimes(input.startedAt, input.endedAt);
  if (problem) return c.json({ message: problem }, 400);
  const start = Date.parse(input.startedAt); const end = Date.parse(input.endedAt);
  if (plannerDateOf(start) !== plannerDateOf(end - 1)) return c.json({ message: "새벽 3시(하루 경계)를 넘기는 기록은 두 개로 나눠 입력하세요." }, 400);
  let categoryId = existing.category_id; let name = existing.category_name;
  if (input.categoryId !== undefined) {
    categoryId = input.categoryId;
    name = null;
    if (categoryId) {
      const category = await categoryName(db, userId, categoryId);
      if (!category) return c.json({ message: "카테고리를 찾을 수 없습니다." }, 404);
      name = category.name;
    }
  }
  await db.prepare("UPDATE focus_sessions SET todo_title = ?, category_id = ?, category_name = ?, planner_date = ?, started_at = ?, ended_at = ?, duration_minutes = ? WHERE id = ? AND user_id = ?")
    .bind(optional(input.title) ?? existing.todo_title, categoryId, name, plannerDateOf(start), new Date(start).toISOString(), new Date(end).toISOString(), Math.max(1, Math.round((end - start) / 60_000)), id, userId).run();
  return c.json({ timeEntries: await loadEntries(db, userId, [id]) });
});

timeTrackingRoutes.delete("/time-entries/:id", async (c) => {
  await c.env.DB.prepare("DELETE FROM focus_sessions WHERE id = ? AND user_id = ? AND mode = 'FOCUS'").bind(c.req.param("id"), c.get("userId")).run();
  return c.json({ ok: true });
});

const optionalRange = z.object({ from: dateKey.optional(), to: dateKey.optional() });

/** Cumulative measured minutes per project (all time, or within a planner-date range). */
timeTrackingRoutes.get("/time-summary", async (c) => {
  const { from, to } = optionalRange.parse({ from: c.req.query("from"), to: c.req.query("to") });
  const { results } = await c.env.DB.prepare(
    "SELECT project_id, SUM(duration_minutes) AS minutes FROM focus_sessions WHERE user_id = ? AND mode = 'FOCUS' AND (? IS NULL OR planner_date >= ?) AND (? IS NULL OR planner_date <= ?) GROUP BY project_id",
  ).bind(c.get("userId"), from ?? null, from ?? null, to ?? null, to ?? null).all<{ project_id: string | null; minutes: number }>();
  const byProject = results.filter((row) => row.project_id).map((row) => ({ projectId: row.project_id as string, minutes: Number(row.minutes) }));
  return c.json({ byProject, totalMinutes: results.reduce((sum, row) => sum + Number(row.minutes), 0) });
});
