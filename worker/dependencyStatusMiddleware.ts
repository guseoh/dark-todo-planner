import type { MiddlewareHandler } from "hono";
import { syncDependentsForBlocker } from "./todoDependencies";
import type { Bindings, Variables } from "./types";

type AppEnv = { Bindings: Bindings; Variables: Variables };
type JsonObject = Record<string, unknown>;

const isObject = (value: unknown): value is JsonObject => Boolean(value) && typeof value === "object" && !Array.isArray(value);

export const dependencyStatusMiddleware: MiddlewareHandler<AppEnv> = async (c, next) => {
  const method = c.req.method.toUpperCase();
  const path = c.req.path;
  const userId = c.get("userId");
  let blockerIds: string[] = [];
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
  } else if (method === "POST" && path === "/api/todos/bulk-update") {
    try {
      const input = await c.req.raw.clone().json();
      if (isObject(input) && isObject(input.action) && input.action.type === "WORKFLOW_STATUS" && Array.isArray(input.ids)) {
        shouldSync = true;
        blockerIds = Array.from(new Set(input.ids.filter((value): value is string => typeof value === "string").map((value) => value.trim()).filter(Boolean))).slice(0, 4000);
      }
    } catch { /* validation route will handle malformed JSON */ }
  }

  await next();
  if (!shouldSync || !c.res.ok) return;
  for (const blockerId of blockerIds) await syncDependentsForBlocker(c.env.DB, userId, blockerId);
};
