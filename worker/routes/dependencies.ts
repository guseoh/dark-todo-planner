import { Hono } from "hono";
import { z } from "zod";
import { inspectDependencySelection, listTodoBlockers, replaceTodoDependencies, syncBlockedTodoStatus, syncDependentsForBlocker } from "../todoDependencies";
import type { Bindings, Variables } from "../types";

export const dependencyRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>();

const dependencyInputSchema = z.object({ blockingTodoIds: z.array(z.string()).max(20).default([]) });

async function ensureTodo(db: D1Database, userId: string, id: string) {
  return db.prepare("SELECT id FROM todos WHERE user_id = ? AND id = ? LIMIT 1").bind(userId, id).first<{ id: string }>();
}

dependencyRoutes.get("/todos/:id/dependencies", async (c) => {
  const id = c.req.param("id");
  const userId = c.get("userId");
  if (!await ensureTodo(c.env.DB, userId, id)) return c.json({ message: "Todo를 찾을 수 없습니다." }, 404);
  const blockers = await listTodoBlockers(c.env.DB, userId, id);
  return c.json({ blockingTodoIds: blockers.map((todo) => todo.id), blockers });
});

dependencyRoutes.put("/todos/:id/dependencies", async (c) => {
  const id = c.req.param("id");
  const userId = c.get("userId");
  if (!await ensureTodo(c.env.DB, userId, id)) return c.json({ message: "Todo를 찾을 수 없습니다." }, 404);
  const input = dependencyInputSchema.parse(await c.req.json());
  try {
    const selection = await inspectDependencySelection(c.env.DB, userId, id, input.blockingTodoIds);
    await replaceTodoDependencies(c.env.DB, userId, id, selection.ids);
    await syncBlockedTodoStatus(c.env.DB, userId, id);
    const blockers = await listTodoBlockers(c.env.DB, userId, id);
    const todo = await c.env.DB.prepare("SELECT workflow_status AS workflowStatus, completed FROM todos WHERE user_id = ? AND id = ? LIMIT 1")
      .bind(userId, id).first<{ workflowStatus: string; completed: number }>();
    return c.json({
      blockingTodoIds: blockers.map((entry) => entry.id),
      blockers,
      workflowStatus: todo?.workflowStatus || "TODO",
      completed: Boolean(todo?.completed),
    });
  } catch (error) {
    return c.json({ message: error instanceof Error ? error.message : "Todo 의존 관계를 저장하지 못했습니다." }, 400);
  }
});

dependencyRoutes.post("/todos/:id/dependents/sync", async (c) => {
  const id = c.req.param("id");
  const userId = c.get("userId");
  if (!await ensureTodo(c.env.DB, userId, id)) return c.json({ message: "Todo를 찾을 수 없습니다." }, 404);
  await syncDependentsForBlocker(c.env.DB, userId, id);
  return c.json({ ok: true });
});
