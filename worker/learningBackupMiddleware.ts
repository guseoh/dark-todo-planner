import type { MiddlewareHandler } from "hono";
import type { Bindings, Variables } from "./types";
import { newId, nowIso } from "./utils";

type AppEnv = { Bindings: Bindings; Variables: Variables };
type BackupObject = Record<string, unknown>;
type RawItem = Record<string, unknown>;

type LearningBackupRow = {
  id: string;
  learningDate: string;
  type: string;
  title: string;
  summary: string | null;
  sourceUrl: string | null;
  sourceName: string | null;
  status: string;
  externalKey: string;
  todoId: string | null;
  createdAt: string;
  updatedAt: string;
};

const isObject = (value: unknown): value is RawItem => !!value && typeof value === "object" && !Array.isArray(value);
const text = (value: unknown, max: number) => typeof value === "string" ? value.trim().slice(0, max) : "";
const validDate = (value: unknown) => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : "";
const validType = (value: unknown) => value === "DAILY_PROBLEM" || value === "TECH_BLOG" ? value : "";
const validStatus = (value: unknown) => ["UNREAD", "READING", "DONE", "SKIPPED"].includes(String(value)) ? String(value) : "UNREAD";
const validUrl = (value: unknown) => {
  const candidate = text(value, 2048);
  if (!candidate) return "";
  try {
    const protocol = new URL(candidate).protocol;
    return protocol === "http:" || protocol === "https:" ? candidate : "";
  } catch {
    return "";
  }
};

const replaceResponseJson = (c: Parameters<MiddlewareHandler<AppEnv>>[0], payload: BackupObject) => {
  const headers = new Headers(c.res.headers);
  headers.set("content-type", "application/json; charset=UTF-8");
  c.res = new Response(JSON.stringify(payload), { status: c.res.status, headers });
};

export const learningBackupExportMiddleware: MiddlewareHandler<AppEnv> = async (c, next) => {
  await next();
  if (!c.res.ok || c.req.method !== "GET") return;
  const payload = await c.res.clone().json<BackupObject>();
  const rows = await c.env.DB.prepare(`
    SELECT id, learning_date AS learningDate, type, title, summary, source_url AS sourceUrl,
      source_name AS sourceName, status, external_key AS externalKey, todo_id AS todoId,
      created_at AS createdAt, updated_at AS updatedAt
    FROM learning_items WHERE user_id = ? ORDER BY learning_date DESC, created_at DESC
  `).bind(c.get("userId")).all<LearningBackupRow>();
  replaceResponseJson(c, { ...payload, learningItems: rows.results });
};

export const learningBackupImportMiddleware: MiddlewareHandler<AppEnv> = async (c, next) => {
  let input: BackupObject = {};
  try {
    const parsed = await c.req.raw.clone().json();
    if (isObject(parsed)) input = parsed;
  } catch {
    return next();
  }

  await next();
  if (!c.res.ok || c.req.method !== "POST") return;

  const userId = c.get("userId");
  const todoResult = await c.env.DB.prepare("SELECT id FROM todos WHERE user_id = ?").bind(userId).all<{ id: string }>();
  const todoIds = new Set(todoResult.results.map((row) => row.id));
  const now = nowIso();
  const seenIds = new Set<string>();
  const seenExternalKeys = new Set<string>();
  const normalized: LearningBackupRow[] = [];

  for (const raw of Array.isArray(input.learningItems) ? input.learningItems : []) {
    if (!isObject(raw)) continue;
    const id = text(raw.id, 120) || newId();
    const learningDate = validDate(raw.learningDate);
    const type = validType(raw.type);
    const title = text(raw.title, 240);
    const externalKey = text(raw.externalKey, 240);
    if (!learningDate || !type || !title || !externalKey || seenIds.has(id) || seenExternalKeys.has(externalKey)) continue;
    seenIds.add(id); seenExternalKeys.add(externalKey);
    normalized.push({
      id,
      learningDate,
      type,
      title,
      summary: text(raw.summary, 8000) || null,
      sourceUrl: validUrl(raw.sourceUrl) || null,
      sourceName: text(raw.sourceName, 80) || null,
      status: validStatus(raw.status),
      externalKey,
      todoId: typeof raw.todoId === "string" && todoIds.has(raw.todoId) ? raw.todoId : null,
      createdAt: text(raw.createdAt, 80) || now,
      updatedAt: text(raw.updatedAt, 80) || now,
    });
  }

  await c.env.DB.prepare("DELETE FROM learning_items WHERE user_id = ?").bind(userId).run();
  if (normalized.length) {
    await c.env.DB.prepare(`
      INSERT INTO learning_items (
        id, user_id, learning_date, type, title, summary, source_url, source_name,
        status, external_key, todo_id, created_at, updated_at
      )
      SELECT
        json_extract(value, '$.id'), ?, json_extract(value, '$.learningDate'), json_extract(value, '$.type'),
        json_extract(value, '$.title'), json_extract(value, '$.summary'), json_extract(value, '$.sourceUrl'),
        json_extract(value, '$.sourceName'), json_extract(value, '$.status'), json_extract(value, '$.externalKey'),
        json_extract(value, '$.todoId'), json_extract(value, '$.createdAt'), json_extract(value, '$.updatedAt')
      FROM json_each(?)
    `).bind(userId, JSON.stringify(normalized)).run();
  }

  const payload = await c.res.clone().json<BackupObject>();
  const imported = isObject(payload.imported) ? payload.imported : {};
  replaceResponseJson(c, { ...payload, imported: { ...imported, learningItems: normalized.length } });
};
