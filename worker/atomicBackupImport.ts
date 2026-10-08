import { Hono } from "hono";
import { BACKUP_VERSION, BackupFormatError, SUPPORTED_BACKUP_VERSIONS } from "./backupFormat";
import { restoreRound2Backup } from "./backupRound2";
import { validateFullRestoreBackup } from "./backupRestoreValidation";
import { planCoreBackupImport } from "./routes/backup";
import type { Bindings, Variables } from "./types";
import { nowIso } from "./utils";

type Entry = Record<string, unknown>;
type AppEnv = { Bindings: Bindings; Variables: Variables };
const MAX_ATOMIC_STATEMENTS = 50;
const row = (value: unknown): Entry => value !== null && typeof value === "object" && !Array.isArray(value) ? value as Entry : {};
const text = (value: unknown, max: number) => typeof value === "string" ? value.trim().slice(0, max) : "";
const timestamp = (value: unknown, now: string) => typeof value === "string" && value ? value : now;
const date = (value: unknown) => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : "";
const priority = (value: unknown) => value === "LOW" || value === "MEDIUM" || value === "HIGH" ? value : "MEDIUM";
const records = (root: Entry, key: string): Entry[] => root[key] as Entry[];

const referenceUrl = (value: unknown) => {
  if (typeof value !== "string" || !value.trim() || value.length > 2048) return "";
  try {
    const parsed = new URL(value.trim());
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.toString() : "";
  } catch { return ""; }
};

/** Build all dependent writes first. NO D1 writes may happen during planning. */
export async function planAtomicFullBackupRestore(env: Bindings, userId: string, input: unknown) {
  const backup = validateFullRestoreBackup(input);
  const now = nowIso();

  const core = await planCoreBackupImport(env, userId, backup);
  const extensionStatements: D1PreparedStatement[] = [];
  const extension = await restoreRound2Backup(env, userId, backup, extensionStatements);

  const statements: D1PreparedStatement[] = [
    ...core.statements,
    ...extensionStatements,
  ];

  // Routines are recreated after projects, categories, and todos exist.
  const routines = records(backup, "routineTemplates");
  const items = records(backup, "routineTemplateItems");
  const runs = records(backup, "routineRuns");
  const projectIds = new Set(records(backup, "projects").map((item) => item.id));
  const categoryIds = new Set(records(backup, "categories").map((item) => item.id));

  statements.push(
    env.DB.prepare("DELETE FROM routine_runs WHERE routine_id IN (SELECT id FROM routine_templates WHERE user_id = ?)").bind(userId),
    env.DB.prepare("DELETE FROM routine_template_items WHERE routine_id IN (SELECT id FROM routine_templates WHERE user_id = ?)").bind(userId),
    env.DB.prepare("DELETE FROM routine_templates WHERE user_id = ?").bind(userId),
  );
  for (const r of routines) {
    statements.push(env.DB.prepare(
      "INSERT INTO routine_templates (id, user_id, name, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
    ).bind(text(r.id, 120), userId, text(r.name, 80), text(r.description, 500) || null, timestamp(r.createdAt, now), timestamp(r.updatedAt, now)));
  }
  for (const item of items) {
    const projectId = text(item.projectId, 120);
    const categoryId = text(item.categoryId, 120);
    statements.push(env.DB.prepare(
      "INSERT INTO routine_template_items (id, routine_id, title, priority, project_id, category_id, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    ).bind(
      text(item.id, 120), text(item.routineId, 120), text(item.title, 240), priority(item.priority),
      projectIds.has(projectId) ? projectId : null, categoryIds.has(categoryId) ? categoryId : null,
      typeof item.sortOrder === "number" ? Math.max(0, Math.trunc(item.sortOrder)) : 0,
      timestamp(item.createdAt, now), timestamp(item.updatedAt, now),
    ));
  }
  for (const run of runs) {
    statements.push(env.DB.prepare(
      "INSERT INTO routine_runs (id, routine_id, target_date, created_at) VALUES (?, ?, ?, ?)",
    ).bind(text(run.id, 120), text(run.routineId, 120), date(run.targetDate), timestamp(run.createdAt, now)));
  }

  const scratchpad = row(backup.scratchpad);
  statements.push(env.DB.prepare(
    `INSERT INTO scratchpads (user_id, content, created_at, updated_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET content = excluded.content, updated_at = excluded.updated_at`,
  ).bind(userId, scratchpad.content, now, now));

  let todoReferenceLinks = 0;
  for (const todo of records(backup, "todos")) {
    const url = referenceUrl(todo.referenceUrl);
    if (!url) continue;
    statements.push(env.DB.prepare(
      "UPDATE todos SET reference_url = ?, reference_label = ? WHERE id = ? AND user_id = ?",
    ).bind(url, text(todo.referenceLabel, 80) || null, todo.id, userId));
    todoReferenceLinks++;
  }

  // D1 batch() is one SQLite transaction. Splitting/chunking this list into
  // several batches would silently reintroduce the partial-restore problem.
  if (statements.length > MAX_ATOMIC_STATEMENTS) {
    throw new BackupFormatError(
      `전체 복원에 SQL ${statements.length}문장이 필요하여 원자적 실행 한도 ${MAX_ATOMIC_STATEMENTS}문장을 초과합니다. 데이터는 전혀 수정하지 않았습니다. D1 SQL 백업 복구 절차를 이용하세요.`,
    );
  }
  return {
    statements,
    result: {
      ok: true,
      version: BACKUP_VERSION,
      latestVersion: BACKUP_VERSION,
      supportedVersions: [...SUPPORTED_BACKUP_VERSIONS],
      warnings: [...core.result.warnings, ...extension.warnings],
      imported: {
        ...core.result.imported, ...extension.imported,
        routineTemplates: routines.length, routineTemplateItems: items.length, routineRuns: runs.length,
        todoReferenceLinks, scratchpad: 1,
      },
    },
  };
}

export const atomicBackupRoutes = new Hono<AppEnv>();
atomicBackupRoutes.post("/backup/import", async (c) => {
  let payload: unknown;
  try { payload = await c.req.json(); }
  catch { return c.json({ message: "유효한 JSON 백업 파일이 아닙니다." }, 400); }

  try {
    const { statements, result } = await planAtomicFullBackupRestore(c.env, c.get("userId"), payload);
    // The only write in the entire full-import path. A failed statement
    // aborts and rolls back the complete transaction in Cloudflare D1.
    await c.env.DB.batch(statements);
    return c.json(result);
  } catch (error) {
    if (error instanceof BackupFormatError) return c.json({ message: error.message }, 400);
    console.error("[backup-atomic] full restore rolled back", error);
    return c.json({ message: "전체 복원 트랜잭션에 실패하여 변경사항을 롤백했습니다. 기존 데이터를 확인하세요." }, 500);
  }
});
