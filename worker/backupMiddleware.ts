import type { MiddlewareHandler } from "hono";
import { BACKUP_VERSION, SUPPORTED_BACKUP_VERSIONS } from "./backupFormat";
import { exportRound2Backup, mergeRound2Backup, restoreRound2Backup, restoreSuspendedAutoArchive, suspendAutoArchive } from "./backupRound2";
import type { Bindings, Variables } from "./types";

type AppEnv = { Bindings: Bindings; Variables: Variables };
type JsonRecord = Record<string, unknown>;

const asRecord = (value: unknown): JsonRecord | undefined => value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : undefined;
const validReferenceUrl = (value: unknown) => {
  if (typeof value !== "string" || !value.trim() || value.length > 2048) return "";
  try {
    const url = new URL(value.trim());
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : "";
  } catch {
    return "";
  }
};

async function restoreTodoReferenceLinks(env: Bindings, userId: string, input: unknown) {
  const root = asRecord(input);
  const todoItems = root && Array.isArray(root.todos) ? root.todos : [];
  const statements: D1PreparedStatement[] = [];
  for (const item of todoItems) {
    const todo = asRecord(item);
    if (!todo || typeof todo.id !== "string") continue;
    const referenceUrl = validReferenceUrl(todo.referenceUrl);
    if (!referenceUrl) continue;
    const referenceLabel = typeof todo.referenceLabel === "string" && todo.referenceLabel.trim()
      ? todo.referenceLabel.trim().slice(0, 80)
      : null;
    statements.push(env.DB.prepare("UPDATE todos SET reference_url = ?, reference_label = ? WHERE id = ? AND user_id = ?")
      .bind(referenceUrl, referenceLabel, todo.id, userId));
  }
  for (let index = 0; index < statements.length; index += 40) await env.DB.batch(statements.slice(index, index + 40));
  return statements.length;
}

export const backupV9ExportMiddleware: MiddlewareHandler<AppEnv> = async (c, next) => {
  await next();
  if (!c.res.ok) return;
  const base = await c.res.clone().json() as JsonRecord;
  c.res = c.json(mergeRound2Backup(base, await exportRound2Backup(c.env, c.get("userId"))));
};

export const backupV9ImportMiddleware: MiddlewareHandler<AppEnv> = async (c, next) => {
  let input: unknown;
  try { input = await c.req.raw.clone().json(); }
  catch { await next(); return; }
  const userId = c.get("userId");
  const previousAutoArchive = await suspendAutoArchive(c.env, userId);
  try {
    await next();
    if (!c.res.ok) { await restoreSuspendedAutoArchive(c.env, userId, previousAutoArchive); return; }
    const base = await c.res.clone().json() as JsonRecord;
    const extension = await restoreRound2Backup(c.env, userId, input);
    const todoReferenceLinks = await restoreTodoReferenceLinks(c.env, userId, input);
    const baseImported = base.imported && typeof base.imported === "object" && !Array.isArray(base.imported) ? base.imported as JsonRecord : {};
    const baseWarnings = Array.isArray(base.warnings) ? base.warnings.map(String) : [];
    c.res = c.json({ ...base, latestVersion: BACKUP_VERSION, supportedVersions: [...SUPPORTED_BACKUP_VERSIONS], imported: { ...baseImported, ...extension.imported, todoReferenceLinks }, warnings: [...baseWarnings, ...extension.warnings] });
  } catch (error) {
    await restoreSuspendedAutoArchive(c.env, userId, previousAutoArchive);
    console.error("[backup-v9] round2 restore failed", error);
    c.res = c.json({ message: error instanceof Error ? error.message : "v9 확장 데이터를 복원하지 못했습니다." }, 400);
  }
};
