import { Hono } from "hono";
import { z } from "zod";
import type { Bindings, Variables } from "../types";
import { nowIso } from "../utils";

type WorkflowTodo = { id: string; title: string; completed: number; archived: number; workflowStatus: string };
type ReminderRow = { remindAt: string; status: "PENDING" | "SENT" | "CANCELLED"; sentAt: string | null };

export const todoWorkflowRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>();
const dependencyInputSchema = z.object({ blockingTodoId: z.string().trim().min(1).max(128) });
const reminderInputSchema = z.object({ remindAt: z.union([z.iso.datetime({ offset: true }), z.null()]) });

const findTodo = (db: D1Database, userId: string, id: string) =>
  db.prepare("SELECT id, title, completed, archived, workflow_status AS workflowStatus FROM todos WHERE id = ? AND user_id = ? LIMIT 1").bind(id, userId).first<WorkflowTodo>();

todoWorkflowRoutes.get("/todos/:id/workflow", async (c) => {
  const db = c.env.DB, userId = c.get("userId"), todoId = c.req.param("id");
  if (!await findTodo(db, userId, todoId)) return c.json({ message: "Todo를 찾을 수 없습니다." }, 404);
  const [blockers, dependents, activity, reminder] = await Promise.all([
    db.prepare("SELECT t.id, t.title, t.completed, t.workflow_status AS workflowStatus FROM todo_dependencies d JOIN todos t ON t.id = d.blocking_todo_id WHERE d.user_id = ? AND d.blocked_todo_id = ? ORDER BY d.created_at, t.title").bind(userId, todoId).all(),
    db.prepare("SELECT t.id, t.title, t.completed, t.workflow_status AS workflowStatus FROM todo_dependencies d JOIN todos t ON t.id = d.blocked_todo_id WHERE d.user_id = ? AND d.blocking_todo_id = ? ORDER BY d.created_at, t.title").bind(userId, todoId).all(),
    db.prepare("SELECT id, action, changes_json AS changesJson, created_at AS createdAt FROM todo_activity WHERE user_id = ? AND todo_id = ? ORDER BY created_at DESC, id DESC LIMIT 30").bind(userId, todoId).all<{ id: string; action: string; changesJson: string; createdAt: string }>(),
    db.prepare("SELECT remind_at AS remindAt, status, sent_at AS sentAt FROM todo_reminders WHERE user_id = ? AND todo_id = ? LIMIT 1").bind(userId, todoId).first<ReminderRow>(),
  ]);
  return c.json({
    blockers: blockers.results,
    dependents: dependents.results,
    activity: (activity.results || []).map((entry) => ({ ...entry, changes: JSON.parse(entry.changesJson || "{}"), changesJson: undefined })),
    reminder: reminder || null,
    reminderDeliveryConfigured: Boolean(c.env.DISCORD_WEBHOOK_URL),
  });
});

todoWorkflowRoutes.get("/todos/:id/dependency-options", async (c) => {
  const db = c.env.DB, userId = c.get("userId"), todoId = c.req.param("id"), query = (c.req.query("q") || "").trim().slice(0, 120);
  if (!await findTodo(db, userId, todoId)) return c.json({ message: "Todo를 찾을 수 없습니다." }, 404);
  if (query.length < 1) return c.json({ todos: [] });
  const result = await db.prepare("SELECT id, title, completed, workflow_status AS workflowStatus FROM todos WHERE user_id = ? AND id <> ? AND archived = 0 AND instr(lower(title), lower(?)) > 0 ORDER BY completed, date, created_at DESC LIMIT 20").bind(userId, todoId, query).all();
  return c.json({ todos: result.results });
});

todoWorkflowRoutes.post("/todos/:id/dependencies", async (c) => {
  const db = c.env.DB, userId = c.get("userId"), todoId = c.req.param("id");
  const { blockingTodoId } = dependencyInputSchema.parse(await c.req.json());
  if (blockingTodoId === todoId) return c.json({ message: "선행 작업을 다시 확인해주세요." }, 400);
  const [todo, blocker] = await Promise.all([findTodo(db, userId, todoId), findTodo(db, userId, blockingTodoId)]);
  if (!todo || !blocker) return c.json({ message: "현재 사용자에게 속한 작업만 연결할 수 있습니다." }, 400);
  const cycle = await db.prepare(`WITH RECURSIVE reachable(id) AS (
    SELECT blocked_todo_id FROM todo_dependencies WHERE user_id = ? AND blocking_todo_id = ?
    UNION
    SELECT d.blocked_todo_id FROM todo_dependencies d JOIN reachable r ON d.blocking_todo_id = r.id WHERE d.user_id = ?
  ) SELECT 1 AS cycle FROM reachable WHERE id = ? LIMIT 1`).bind(userId, todoId, userId, blockingTodoId).first<{ cycle: number }>();
  if (cycle) return c.json({ message: "이 연결은 순환 의존 관계를 만듭니다." }, 400);
  await db.prepare("INSERT OR IGNORE INTO todo_dependencies (user_id, blocking_todo_id, blocked_todo_id, created_at) VALUES (?, ?, ?, ?)").bind(userId, blockingTodoId, todoId, nowIso()).run();
  return c.json({ ok: true });
});

todoWorkflowRoutes.delete("/todos/:id/dependencies/:blockingTodoId", async (c) => {
  const db = c.env.DB, userId = c.get("userId"), todoId = c.req.param("id");
  await db.prepare("DELETE FROM todo_dependencies WHERE user_id = ? AND blocked_todo_id = ? AND blocking_todo_id = ?").bind(userId, todoId, c.req.param("blockingTodoId")).run();
  return c.json({ ok: true });
});

todoWorkflowRoutes.put("/todos/:id/reminder", async (c) => {
  const db = c.env.DB, userId = c.get("userId"), todoId = c.req.param("id");
  const todo = await findTodo(db, userId, todoId);
  if (!todo) return c.json({ message: "Todo를 찾을 수 없습니다." }, 404);
  const { remindAt: inputRemindAt } = reminderInputSchema.parse(await c.req.json());
  if (inputRemindAt === null || inputRemindAt === "") {
    await db.prepare("UPDATE todo_reminders SET status = 'CANCELLED', claim_token = NULL, claimed_at = NULL, updated_at = ? WHERE user_id = ? AND todo_id = ?").bind(nowIso(), userId, todoId).run();
    return c.json({ ok: true });
  }
  if (todo.completed || todo.archived) return c.json({ message: "완료 또는 보관된 작업에는 알림을 설정할 수 없습니다." }, 400);
  const remindAt = typeof inputRemindAt === "string" && Number.isFinite(Date.parse(inputRemindAt)) ? new Date(inputRemindAt).toISOString() : "";
  if (!remindAt || Date.parse(remindAt) <= Date.now()) return c.json({ message: "미래 시각을 선택해주세요." }, 400);
  const now = nowIso();
  await db.prepare(`INSERT INTO todo_reminders (id, user_id, todo_id, remind_at, channel, status, sent_at, claim_token, claimed_at, created_at, updated_at)
    VALUES (?, ?, ?, ?, 'DISCORD', 'PENDING', NULL, NULL, NULL, ?, ?)
    ON CONFLICT(todo_id) DO UPDATE SET remind_at = excluded.remind_at, channel = 'DISCORD', status = 'PENDING', sent_at = NULL, claim_token = NULL, claimed_at = NULL, updated_at = excluded.updated_at
    WHERE todo_reminders.user_id = excluded.user_id`).bind(crypto.randomUUID(), userId, todoId, remindAt, now, now).run();
  return c.json({ ok: true, remindAt });
});
