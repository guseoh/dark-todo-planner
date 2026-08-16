import { and, asc, desc, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { Hono } from "hono";
import { timerSettings, todos } from "../db/schema";
import { focusSessionsV2, timeBlocks } from "../db/timeSchema";
import { focusSessionInputSchema, timerSettingsInputSchema, timeBlockInputSchema } from "../timeValidation";
import type { Bindings, Variables } from "../types";
import { newId, nowIso } from "../utils";

export const timeRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>();

const defaultSettings = {
  focusMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  sessionsBeforeLongBreak: 4,
  soundEnabled: true,
  notificationEnabled: false,
};

const plannedMinutes = (startTime: string, endTime: string) => {
  const [startHour, startMinute] = startTime.split(":").map(Number);
  const [endHour, endMinute] = endTime.split(":").map(Number);
  return endHour * 60 + endMinute - (startHour * 60 + startMinute);
};

const validateTodo = async (db: ReturnType<typeof drizzle>, userId: string, todoId?: string | null) => {
  if (!todoId) return undefined;
  const [todo] = await db.select({ id: todos.id, title: todos.title }).from(todos).where(and(eq(todos.id, todoId), eq(todos.userId, userId))).limit(1);
  return todo;
};

timeRoutes.get("/focus-sessions", async (c) => {
  const db = drizzle(c.env.DB);
  const filters = [eq(focusSessionsV2.userId, c.get("userId"))];
  const date = c.req.query("date");
  const todoId = c.req.query("todoId");
  if (date) filters.push(eq(focusSessionsV2.plannerDate, date));
  if (todoId) filters.push(eq(focusSessionsV2.todoId, todoId));
  const rows = await db.select().from(focusSessionsV2).where(and(...filters)).orderBy(desc(focusSessionsV2.startedAt)).limit(200);
  return c.json({ focusSessions: rows });
});

timeRoutes.post("/focus-sessions", async (c) => {
  const input = focusSessionInputSchema.parse(await c.req.json());
  const db = drizzle(c.env.DB);
  const userId = c.get("userId");
  const todo = await validateTodo(db, userId, input.todoId);
  if (input.todoId && !todo) return c.json({ message: "Todo를 찾을 수 없습니다." }, 400);
  const row = {
    id: newId(),
    userId,
    todoId: todo?.id || null,
    todoTitle: todo?.title || null,
    mode: input.mode,
    durationMinutes: input.durationMinutes,
    plannerDate: input.plannerDate,
    startedAt: input.startedAt,
    endedAt: input.endedAt,
    completed: input.completed,
    createdAt: nowIso(),
  };
  await db.insert(focusSessionsV2).values(row);
  return c.json({ focusSession: row }, 201);
});

timeRoutes.get("/timer-settings", async (c) => {
  const db = drizzle(c.env.DB);
  const [row] = await db.select().from(timerSettings).where(eq(timerSettings.userId, c.get("userId"))).limit(1);
  return c.json({ timerSettings: row || defaultSettings });
});

timeRoutes.put("/timer-settings", async (c) => {
  const input = timerSettingsInputSchema.parse(await c.req.json());
  const db = drizzle(c.env.DB);
  const userId = c.get("userId");
  const now = nowIso();
  const [existing] = await db.select().from(timerSettings).where(eq(timerSettings.userId, userId)).limit(1);
  if (existing) {
    await db.update(timerSettings).set({ ...input, updatedAt: now }).where(eq(timerSettings.id, existing.id));
  } else {
    await db.insert(timerSettings).values({ id: newId(), userId, ...input, createdAt: now, updatedAt: now });
  }
  const [row] = await db.select().from(timerSettings).where(eq(timerSettings.userId, userId)).limit(1);
  return c.json({ timerSettings: row });
});

timeRoutes.get("/time-blocks", async (c) => {
  const db = drizzle(c.env.DB);
  const filters = [eq(timeBlocks.userId, c.get("userId"))];
  const date = c.req.query("date");
  const from = c.req.query("from");
  const to = c.req.query("to");
  if (date) filters.push(eq(timeBlocks.date, date));
  else {
    if (from) filters.push(sql`${timeBlocks.date} >= ${from}`);
    if (to) filters.push(sql`${timeBlocks.date} <= ${to}`);
  }
  const rows = await db.select().from(timeBlocks).where(and(...filters)).orderBy(asc(timeBlocks.date), asc(timeBlocks.startTime)).limit(300);
  return c.json({ timeBlocks: rows });
});

timeRoutes.post("/time-blocks", async (c) => {
  const input = timeBlockInputSchema.parse(await c.req.json());
  const db = drizzle(c.env.DB);
  const userId = c.get("userId");
  const minutes = plannedMinutes(input.startTime, input.endTime);
  if (minutes <= 0) return c.json({ message: "종료 시간은 시작 시간보다 뒤여야 합니다." }, 400);
  const todo = await validateTodo(db, userId, input.todoId);
  if (input.todoId && !todo) return c.json({ message: "Todo를 찾을 수 없습니다." }, 400);
  const now = nowIso();
  const row = {
    id: newId(), userId, todoId: todo?.id || null, title: input.title, date: input.date,
    startTime: input.startTime, endTime: input.endTime, plannedMinutes: minutes,
    completed: input.completed || false, createdAt: now, updatedAt: now,
  };
  await db.insert(timeBlocks).values(row);
  return c.json({ timeBlock: { ...row, todoId: row.todoId || undefined } }, 201);
});

timeRoutes.put("/time-blocks/:id", async (c) => {
  const input = timeBlockInputSchema.parse(await c.req.json());
  const db = drizzle(c.env.DB);
  const id = c.req.param("id"), userId = c.get("userId");
  const [existing] = await db.select().from(timeBlocks).where(and(eq(timeBlocks.id, id), eq(timeBlocks.userId, userId))).limit(1);
  if (!existing) return c.json({ message: "시간 블록을 찾을 수 없습니다." }, 404);
  const minutes = plannedMinutes(input.startTime, input.endTime);
  if (minutes <= 0) return c.json({ message: "종료 시간은 시작 시간보다 뒤여야 합니다." }, 400);
  const todo = await validateTodo(db, userId, input.todoId);
  if (input.todoId && !todo) return c.json({ message: "Todo를 찾을 수 없습니다." }, 400);
  await db.update(timeBlocks).set({
    todoId: todo?.id || null, title: input.title, date: input.date, startTime: input.startTime, endTime: input.endTime,
    plannedMinutes: minutes, completed: input.completed ?? existing.completed, updatedAt: nowIso(),
  }).where(eq(timeBlocks.id, id));
  const [row] = await db.select().from(timeBlocks).where(eq(timeBlocks.id, id));
  return c.json({ timeBlock: { ...row, todoId: row.todoId || undefined } });
});

timeRoutes.delete("/time-blocks/:id", async (c) => {
  const db = drizzle(c.env.DB);
  await db.delete(timeBlocks).where(and(eq(timeBlocks.id, c.req.param("id")), eq(timeBlocks.userId, c.get("userId"))));
  return c.json({ ok: true });
});
