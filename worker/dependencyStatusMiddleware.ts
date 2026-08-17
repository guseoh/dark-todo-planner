import type { MiddlewareHandler } from "hono";
import { syncKnownBlockedTodos, syncStatusesForChangedTodos } from "./todoDependencies";
import type { Bindings, Variables } from "./types";

type AppEnv = { Bindings: Bindings; Variables: Variables };
type JsonObject = Record<string, unknown>;

const isObject = (value: unknown): value is JsonObject => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const cleanIds = (value: unknown, limit = 4000) => Array.isArray(value)
  ? Array.from(new Set(value.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean))).slice(0, limit)
  : [];

const dependentIdsForBlockers = async (db: D1Database, userId: string, blockerIds: string[]) => {
  if (!blockerIds.length) return [];
  const result: string[] = [];
  for (let index = 0; index < blockerIds.length; index += 80) {
    const chunk = blockerIds.slice(index, index + 80);
    const placeholders = chunk.map(() => "?").join(",");
    const rows = await db.prepare(`SELECT DISTINCT blocked_todo_id AS id FROM todo_dependencies WHERE user_id = ? AND blocking_todo_id IN (${placeholders})`)
      .bind(userId, ...chunk).all<{ id: string }>();
    result.push(...rows.results.map((row) => row.id));
  }
  return Array.from(new Set(result));
};

export const dependencyStatusMiddleware: MiddlewareHandler<AppEnv> = async (c, next) => {
  const method = c.req.method.toUpperCase();
  const path = c.req.path;
  const userId = c.get("userId");
  let changedTodoIds: string[] = [];
  let deletedDependentIds: string[] = [];
  let shouldSync = false;

  if (method === "PUT") {
    const match = path.match(/^\/api\/todos\/([^/]+)$/);
    if (match) {
      try {
        const input = await c.req.raw.clone().json();
        if (isObject(input)) {
          shouldSync = "completed" in input || "workflowStatus" in input;
          if (shouldSync) changedTodoIds = [decodeURIComponent(match[1])];
        }
      } catch { /* validation route will handle malformed JSON */ }
    }
  } else if (method === "PATCH") {
    const match = path.match(/^\/api\/todos\/([^/]+)\/toggle$/);
    if (match) { shouldSync = true; changedTodoIds = [decodeURIComponent(match[1])]; }
  } else if (method === "DELETE") {
    const match = path.match(/^\/api\/todos\/([^/]+)$/);
    if (match) {
      changedTodoIds = [decodeURIComponent(match[1])];
      deletedDependentIds = await dependentIdsForBlockers(c.env.DB, userId, changedTodoIds);
    }
  } else if (method === "POST" && path === "/api/todos/bulk-update") {
    try {
      const input = await c.req.raw.clone().json();
      if (isObject(input) && isObject(input.action) && input.action.type === "WORKFLOW_STATUS") {
        changedTodoIds = cleanIds(input.ids);
        shouldSync = changedTodoIds.length > 0;
      }
    } catch { /* validation route will handle malformed JSON */ }
  } else if (method === "POST" && path === "/api/todos/bulk-trash") {
    try {
      const input = await c.req.raw.clone().json();
      if (isObject(input)) {
        changedTodoIds = cleanIds(input.ids, 100);
        deletedDependentIds = await dependentIdsForBlockers(c.env.DB, userId, changedTodoIds);
      }
    } catch { /* validation route will handle malformed JSON */ }
  } else if (method === "POST") {
    const match = path.match(/^\/api\/todos\/([^/]+)\/trash$/);
    if (match) {
      changedTodoIds = [decodeURIComponent(match[1])];
      deletedDependentIds = await dependentIdsForBlockers(c.env.DB, userId, changedTodoIds);
    }
  }

  await next();
  if (!c.res.ok) return;
  if (shouldSync) await syncStatusesForChangedTodos(c.env.DB, userId, changedTodoIds);
  if (deletedDependentIds.length) await syncKnownBlockedTodos(c.env.DB, userId, deletedDependentIds);
};
