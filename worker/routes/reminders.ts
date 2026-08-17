import { Hono } from "hono";
import { getSnoozedReminderAt, type TodoReminderRow } from "../reminders/todoReminder";
import { reminderInputSchema, reminderSnoozeSchema } from "../step4Validation";
import type { Bindings, Variables } from "../types";
import { newId, nowIso } from "../utils";

export const reminderRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>();

const reminderColumns = `id, todo_id AS todoId, remind_at AS remindAt, channel, status, sent_at AS sentAt, created_at AS createdAt, updated_at AS updatedAt`;

const findTodo = (db: D1Database, userId: string, todoId: string) => db.prepare("SELECT id, completed, archived FROM todos WHERE id = ? AND user_id = ? LIMIT 1").bind(todoId, userId).first<{ id: string; completed: number; archived: number }>();
const findReminder = (db: D1Database, userId: string, todoId: string) => db.prepare(`SELECT ${reminderColumns} FROM todo_reminders WHERE todo_id = ? AND user_id = ? LIMIT 1`).bind(todoId, userId).first<TodoReminderRow>();

reminderRoutes.get("/todos/:id/reminder", async (c) => {
  const todoId = c.req.param("id");
  const userId = c.get("userId");
  if (!await findTodo(c.env.DB, userId, todoId)) return c.json({ message: "Todo를 찾을 수 없습니다." }, 404);
  return c.json({ reminder: await findReminder(c.env.DB, userId, todoId) });
});

reminderRoutes.put("/todos/:id/reminder", async (c) => {
  const todoId = c.req.param("id");
  const userId = c.get("userId");
  const todo = await findTodo(c.env.DB, userId, todoId);
  if (!todo) return c.json({ message: "Todo를 찾을 수 없습니다." }, 404);
  if (todo.completed || todo.archived) return c.json({ message: "완료 또는 보관된 Todo에는 알림을 예약할 수 없습니다." }, 409);
  const input = reminderInputSchema.parse(await c.req.json());
  const remindAt = new Date(input.remindAt);
  if (remindAt.getTime() <= Date.now()) return c.json({ message: "알림 시각은 현재보다 이후여야 합니다." }, 400);
  const now = nowIso();
  const existing = await findReminder(c.env.DB, userId, todoId);
  if (existing) {
    await c.env.DB.prepare(`
      UPDATE todo_reminders SET remind_at = ?, channel = ?, status = 'PENDING', sent_at = NULL,
        claim_token = NULL, claimed_at = NULL, updated_at = ? WHERE id = ? AND user_id = ?
    `).bind(remindAt.toISOString(), input.channel, now, existing.id, userId).run();
  } else {
    await c.env.DB.prepare(`
      INSERT INTO todo_reminders (id, user_id, todo_id, remind_at, channel, status, sent_at, claim_token, claimed_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 'PENDING', NULL, NULL, NULL, ?, ?)
    `).bind(newId(), userId, todoId, remindAt.toISOString(), input.channel, now, now).run();
  }
  return c.json({ reminder: await findReminder(c.env.DB, userId, todoId) });
});

reminderRoutes.delete("/todos/:id/reminder", async (c) => {
  const todoId = c.req.param("id");
  const userId = c.get("userId");
  if (!await findTodo(c.env.DB, userId, todoId)) return c.json({ message: "Todo를 찾을 수 없습니다." }, 404);
  const now = nowIso();
  await c.env.DB.prepare(`
    UPDATE todo_reminders SET status = 'CANCELLED', claim_token = NULL, claimed_at = NULL, updated_at = ?
    WHERE todo_id = ? AND user_id = ?
  `).bind(now, todoId, userId).run();
  return c.json({ reminder: await findReminder(c.env.DB, userId, todoId) });
});

reminderRoutes.post("/todos/:id/reminder/snooze", async (c) => {
  const todoId = c.req.param("id");
  const userId = c.get("userId");
  const todo = await findTodo(c.env.DB, userId, todoId);
  if (!todo) return c.json({ message: "Todo를 찾을 수 없습니다." }, 404);
  if (todo.completed || todo.archived) return c.json({ message: "완료 또는 보관된 Todo에는 알림을 다시 예약할 수 없습니다." }, 409);
  const reminder = await findReminder(c.env.DB, userId, todoId);
  if (!reminder) return c.json({ message: "먼저 Todo 알림을 예약해 주세요." }, 404);
  const { preset } = reminderSnoozeSchema.parse(await c.req.json());
  const now = new Date();
  const remindAt = getSnoozedReminderAt(now, preset).toISOString();
  const updatedAt = now.toISOString();
  await c.env.DB.prepare(`
    UPDATE todo_reminders SET remind_at = ?, status = 'PENDING', sent_at = NULL,
      claim_token = NULL, claimed_at = NULL, updated_at = ? WHERE id = ? AND user_id = ?
  `).bind(remindAt, updatedAt, reminder.id, userId).run();
  return c.json({ reminder: await findReminder(c.env.DB, userId, todoId) });
});
