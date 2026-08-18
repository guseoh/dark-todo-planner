import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { Hono } from "hono";
import { todos } from "../db/schema";
import type { Bindings, Variables } from "../types";
import { nowIso } from "../utils";

export const todoCompletionRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>();

export const toTodoCompletionState = (completed: boolean) => ({
  completed,
  workflowStatus: completed ? "DONE" as const : "TODO" as const,
});

todoCompletionRoutes.put("/todos/:id/completion", async (c) => {
  const body = await c.req.json<{ completed?: unknown }>();
  if (typeof body.completed !== "boolean") {
    return c.json({ message: "완료 상태가 올바르지 않습니다." }, 400);
  }

  const db = drizzle(c.env.DB);
  const id = c.req.param("id");
  const userId = c.get("userId");
  const updatedAt = nowIso();
  const state = toTodoCompletionState(body.completed);

  await db.update(todos).set({
    ...state,
    updatedAt,
  }).where(and(eq(todos.id, id), eq(todos.userId, userId)));

  const [todo] = await db.select({
    id: todos.id,
    completed: todos.completed,
    workflowStatus: todos.workflowStatus,
    updatedAt: todos.updatedAt,
  }).from(todos).where(and(eq(todos.id, id), eq(todos.userId, userId))).limit(1);

  return todo
    ? c.json({ todo })
    : c.json({ message: "Todo를 찾을 수 없습니다." }, 404);
});
