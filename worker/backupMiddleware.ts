import type { MiddlewareHandler } from "hono";
import { BACKUP_VERSION, SUPPORTED_BACKUP_VERSIONS } from "./backupFormat";
import { exportRound2Backup, mergeRound2Backup, restoreRound2Backup, restoreSuspendedAutoArchive, suspendAutoArchive } from "./backupRound2";
import type { Bindings, Variables } from "./types";

type AppEnv = { Bindings: Bindings; Variables: Variables };
type JsonRecord = Record<string, unknown>;

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
    const baseImported = base.imported && typeof base.imported === "object" && !Array.isArray(base.imported) ? base.imported as JsonRecord : {};
    const baseWarnings = Array.isArray(base.warnings) ? base.warnings.map(String) : [];
    c.res = c.json({ ...base, latestVersion: BACKUP_VERSION, supportedVersions: [...SUPPORTED_BACKUP_VERSIONS], imported: { ...baseImported, ...extension.imported }, warnings: [...baseWarnings, ...extension.warnings] });
  } catch (error) {
    await restoreSuspendedAutoArchive(c.env, userId, previousAutoArchive);
    console.error("[backup-v9] round2 restore failed", error);
    c.res = c.json({ message: error instanceof Error ? error.message : "v9 확장 데이터를 복원하지 못했습니다." }, 400);
  }
};
