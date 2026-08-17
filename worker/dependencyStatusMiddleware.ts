import type { MiddlewareHandler } from "hono";
import { syncBlockedTodoStatus, syncDependentsForBlocker } from "./todoDependencies";
import type { Bindings, Variables } from "./types";

type AppEnv = { Bindings: Bindings; Variables: Variables };
type JsonObject = Record<string, unknown>;

const isObject = (value: unknown): value is JsonObject => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const cleanIds = (value: unknown, limit = 4000) => Array.isArray(value)
  ? Array.from(new Set(value.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean))).slice(0, limit)
  : [];

const dependentIdsForBlockers = async (db: D1Database, userId: string, blockerIds: string[]) => {
  if (!blockerIds.length) return [];
  const placeholders = blockerIds.map(() => "?").join(",");
  const result = await db.prepare(`SELECT DISTINCT blocked_todo_id AS id FROM todo_dependencies WHERE user_id = ? AND blocking_todo_id IN (${placeholders})`)
    .bind(userId, ...blockerIds).all<{ id: string }>();
  return result.results.map((row) => row.id);
};

export const dependencyStatusMiddleware: MiddlewareHandler<AppEnv> = async (c, next) => {
  const method = c.req.method.toUpperCase();
  const path = c.req.path;
  const userId = c.get("userId");
  let blockerIds: string[] = [];
  let deletedDependentIds: string[] = [];
  let shouldSync = false;

  if (method === "PUT") {
    const match = path.match(/^\/api\/todos\/([^/]+)$/);
    if (match) {
      try {
        const input = await c.req.raw.clone().json();
        if (isObject(input)) {
          shouldSync = "completed" in input || "workflowStatus" in input;
          if (shouldSync) blockerIds = [decodeURIComponent(match[1])];
        }
      } catch { /* validation route will handle malformed JSON */ }
    }
  } else if (method === "PATCH") {
    const match = path.match(/^\/api\/todos\/([^/]+)\/toggle$/);
    if (match) { shouldSync = true; blockerIds = [decodeURIComponent(match[1])]; }
  } else if (method === "DELETE") {
    const match = path.match(/^\/api\/todos\/([^/]+)$/);
    if (match) {
      blockerIds = [decodeURIComponent(match[1])];
      deletedDependentIds = await dependentIdsForBlockers(c.env.DB, userId, blockerIds);
    }
  } else if (method === "POST" && path === "/api/todos/bulk-update") {
    try {
      const input = await c.req.raw.clone().json();
      if (isObject(input) && isObject(input.action) && input.action.type === "WORKFLOW_STATUS") {
        blockerIds = cleanIds(input.ids);
        shouldSync = blockerIds.length > 0;
      }
    } catch { /* validation route will handle malformed JSON */ }
  } else if (method === "POST" && path === "/api/todos/bulk-trash") {
    try {
      const input = await c.req.raw.clone().json();
      if (isObject(input)) {
        blockerIds = cleanIds(input.ids, 100);
        deletedDependentIds = await dependentIdsForBlockers(c.env.DB, userId, blockerIds);
      }
    } catch { /* validation route will handle malformed JSON */ }
  } else if (method === "POST") {
    const match = path.match(/^\/api\/todos\/([^/]+)\/trash$/);
    if (match) {
      blockerIds = [decodeURIComponent(match[1])];
      deletedDependentIds = await dependentIdsForBlockers(c.env.DB, userId, blockerIds);
    }
  }

  await next();
  if (!c.res.ok) return;
  if (shouldSync) for (const blockerId of blockerIds) await syncDependentsForBlocker(c.env.DB, userId, blockerId);
  for (const blockedTodoId of deletedDependentIds) await syncBlockedTodoStatus(c.env.DB, userId, blockedTodoId);
};
