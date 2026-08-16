import type { MiddlewareHandler } from "hono";
import type { Bindings, Variables } from "./types";

type AppEnv = { Bindings: Bindings; Variables: Variables };
type TrashRow = { originalTodoId: string; payloadJson: string };

const readReference = (payloadJson: string) => {
  try {
    const payload = JSON.parse(payloadJson) as { todo?: Record<string, unknown> };
    const rawUrl = payload.todo?.reference_url;
    if (typeof rawUrl !== "string" || !rawUrl.trim()) return undefined;
    const url = new URL(rawUrl.trim());
    if (url.protocol !== "http:" && url.protocol !== "https:") return undefined;
    const rawLabel = payload.todo?.reference_label;
    return {
      url: url.toString(),
      label: typeof rawLabel === "string" && rawLabel.trim() ? rawLabel.trim().slice(0, 80) : null,
    };
  } catch {
    return undefined;
  }
};

export const todoReferenceTrashRestoreMiddleware: MiddlewareHandler<AppEnv> = async (c, next) => {
  if (c.req.method !== "POST" || !c.req.path.endsWith("/restore")) return next();
  const segments = c.req.path.split("/").filter(Boolean);
  const trashId = segments.at(-2);
  if (!trashId) return next();

  const row = await c.env.DB.prepare("SELECT original_todo_id AS originalTodoId, payload_json AS payloadJson FROM todo_trash WHERE id = ? AND user_id = ? LIMIT 1")
    .bind(trashId, c.get("userId"))
    .first<TrashRow>();
  const reference = row ? readReference(row.payloadJson) : undefined;

  await next();
  if (!c.res.ok || !row || !reference) return;
  try {
    await c.env.DB.prepare("UPDATE todos SET reference_url = ?, reference_label = ? WHERE id = ? AND user_id = ?")
      .bind(reference.url, reference.label, row.originalTodoId, c.get("userId"))
      .run();
  } catch (error) {
    console.error("[reference-link] failed to restore Todo reference link", error);
  }
};
