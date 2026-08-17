import type { MiddlewareHandler } from "hono";
import { deleteAttachmentsForEntities, deleteAttachmentsForEntity } from "./attachments";
import type { Bindings, Variables } from "./types";

type AppEnv = { Bindings: Bindings; Variables: Variables };

type TrashRow = { originalTodoId: string };

export const attachmentCleanupMiddleware: MiddlewareHandler<AppEnv> = async (c, next) => {
  if (c.req.method !== "DELETE") return next();
  const path = c.req.path;
  const userId = c.get("userId");

  if (/^\/api\/memos\/[^/]+$/.test(path)) {
    const id = path.split("/").at(-1)!;
    await next();
    if (c.res.ok) {
      try { await deleteAttachmentsForEntity(c.env, userId, "MEMO", id); }
      catch (error) { console.error("[attachments] failed to cleanup deleted memo attachments", error); }
    }
    return;
  }

  if (/^\/api\/todos\/[^/]+$/.test(path)) {
    const id = path.split("/").at(-1)!;
    await next();
    if (c.res.ok) {
      try { await deleteAttachmentsForEntity(c.env, userId, "TODO", id); }
      catch (error) { console.error("[attachments] failed to cleanup deleted todo attachments", error); }
    }
    return;
  }

  if (/^\/api\/trash\/todos\/[^/]+$/.test(path)) {
    const trashId = path.split("/").at(-1)!;
    const row = await c.env.DB.prepare("SELECT original_todo_id AS originalTodoId FROM todo_trash WHERE id = ? AND user_id = ? LIMIT 1")
      .bind(trashId, userId)
      .first<TrashRow>();
    await next();
    if (c.res.ok && row) {
      try { await deleteAttachmentsForEntity(c.env, userId, "TODO", row.originalTodoId); }
      catch (error) { console.error("[attachments] failed to cleanup permanently deleted todo attachments", error); }
    }
    return;
  }

  if (path === "/api/trash/todos") {
    const result = await c.env.DB.prepare("SELECT original_todo_id AS originalTodoId FROM todo_trash WHERE user_id = ?")
      .bind(userId)
      .all<TrashRow>();
    const ids = (result.results || []).map((row) => row.originalTodoId);
    await next();
    if (c.res.ok && ids.length) {
      try { await deleteAttachmentsForEntities(c.env, userId, "TODO", ids); }
      catch (error) { console.error("[attachments] failed to cleanup emptied trash attachments", error); }
    }
    return;
  }

  return next();
};
