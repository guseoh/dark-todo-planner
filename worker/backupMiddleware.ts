import type { MiddlewareHandler } from "hono";
import { BACKUP_VERSION, SUPPORTED_BACKUP_VERSIONS } from "./backupFormat";
import { exportRound2Backup, mergeRound2Backup, restoreRound2Backup, restoreSuspendedAutoArchive, suspendAutoArchive } from "./backupRound2";
import type { Bindings, Variables } from "./types";
import { nowIso } from "./utils";

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

async function exportScratchpad(env: Bindings, userId: string) {
  const row = await env.DB.prepare("SELECT content, updated_at AS updatedAt FROM scratchpads WHERE user_id = ? LIMIT 1")
    .bind(userId)
    .first<{ content: string; updatedAt: string }>();
  return row ? { content: row.content, updatedAt: row.updatedAt } : { content: "", updatedAt: null };
}

async function restoreScratchpad(env: Bindings, userId: string, input: unknown) {
  const root = asRecord(input);
  const scratchpad = root ? asRecord(root.scratchpad) : undefined;
  if (!scratchpad) return { imported: 0, warning: "" };
  if (typeof scratchpad.content !== "string" || scratchpad.content.length > 1_000_000) {
    return { imported: 0, warning: "scratchpad 내용이 올바르지 않아 기존 낙서장을 유지했습니다." };
  }
  const now = nowIso();
  await env.DB.prepare(`
    INSERT INTO scratchpads (user_id, content, created_at, updated_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET content = excluded.content, updated_at = excluded.updated_at
  `).bind(userId, scratchpad.content, now, now).run();
  return { imported: 1, warning: "" };
}

export const backupV9ExportMiddleware: MiddlewareHandler<AppEnv> = async (c, next) => {
  await next();
  if (!c.res.ok) return;
  const base = await c.res.clone().json() as JsonRecord;
  const [round2, scratchpad] = await Promise.all([
    exportRound2Backup(c.env, c.get("userId")),
    exportScratchpad(c.env, c.get("userId")),
  ]);
  c.res = c.json({ ...mergeRound2Backup(base, round2), scratchpad });
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
    const [extension, scratchpad] = await Promise.all([
      restoreRound2Backup(c.env, userId, input),
      restoreScratchpad(c.env, userId, input),
    ]);
    const todoReferenceLinks = await restoreTodoReferenceLinks(c.env, userId, input);
    const baseImported = base.imported && typeof base.imported === "object" && !Array.isArray(base.imported) ? base.imported as JsonRecord : {};
    const baseWarnings = Array.isArray(base.warnings) ? base.warnings.map(String) : [];
    c.res = c.json({
      ...base,
      latestVersion: BACKUP_VERSION,
      supportedVersions: [...SUPPORTED_BACKUP_VERSIONS],
      imported: { ...baseImported, ...extension.imported, todoReferenceLinks, scratchpad: scratchpad.imported },
      warnings: [...baseWarnings, ...extension.warnings, ...(scratchpad.warning ? [scratchpad.warning] : [])],
    });
  } catch (error) {
    await restoreSuspendedAutoArchive(c.env, userId, previousAutoArchive);
    console.error("[backup-v10] extended restore failed", error);
    c.res = c.json({ message: error instanceof Error ? error.message : "v10 확장 데이터를 복원하지 못했습니다." }, 400);
  }
};
