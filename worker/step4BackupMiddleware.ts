import type { MiddlewareHandler } from "hono";
import type { Bindings, Variables } from "./types";
import { newId, nowIso } from "./utils";

type AppEnv = { Bindings: Bindings; Variables: Variables };
type JsonObject = Record<string, unknown>;
const isObject = (value: unknown): value is JsonObject => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const text = (value: unknown, max: number) => typeof value === "string" ? value.trim().slice(0, max) : "";
const date = (value: unknown) => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : "";
const iso = (value: unknown) => {
  if (typeof value !== "string") return "";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString();
};
const priority = (value: unknown) => value === "LOW" || value === "MEDIUM" || value === "HIGH" ? value : "MEDIUM";

const replaceJson = (c: Parameters<MiddlewareHandler<AppEnv>>[0], payload: JsonObject) => {
  const headers = new Headers(c.res.headers);
  headers.set("content-type", "application/json; charset=UTF-8");
  c.res = new Response(JSON.stringify(payload), { status: c.res.status, headers });
};

export const step4BackupExportMiddleware: MiddlewareHandler<AppEnv> = async (c, next) => {
  await next();
  if (!c.res.ok || c.req.method !== "GET") return;
  const userId = c.get("userId");
  const [templates, items, runs] = await Promise.all([
    c.env.DB.prepare(`SELECT id, name, description, created_at AS createdAt, updated_at AS updatedAt FROM routine_templates WHERE user_id = ?`).bind(userId).all(),
    c.env.DB.prepare(`SELECT i.id, i.routine_id AS routineId, i.title, i.priority, i.project_id AS projectId, i.category_id AS categoryId, i.sort_order AS sortOrder, i.created_at AS createdAt, i.updated_at AS updatedAt FROM routine_template_items i JOIN routine_templates r ON r.id = i.routine_id WHERE r.user_id = ? ORDER BY i.sort_order`).bind(userId).all(),
    c.env.DB.prepare(`SELECT rr.id, rr.routine_id AS routineId, rr.target_date AS targetDate, rr.created_at AS createdAt FROM routine_runs rr JOIN routine_templates r ON r.id = rr.routine_id WHERE r.user_id = ?`).bind(userId).all(),
  ]);
  const payload = await c.res.clone().json() as JsonObject;
  replaceJson(c, { ...payload, routineTemplates: templates.results, routineTemplateItems: items.results, routineRuns: runs.results });
};

export const step4BackupImportMiddleware: MiddlewareHandler<AppEnv> = async (c, next) => {
  let input: JsonObject = {};
  try { const value = await c.req.raw.clone().json(); if (isObject(value)) input = value; } catch { return next(); }
  await next();
  if (!c.res.ok || c.req.method !== "POST") return;

  const userId = c.get("userId");
  const now = nowIso();
  const [projectResult, categoryResult] = await Promise.all([
    c.env.DB.prepare("SELECT id FROM projects WHERE user_id = ?").bind(userId).all<{ id: string }>(),
    c.env.DB.prepare("SELECT id FROM categories WHERE user_id = ?").bind(userId).all<{ id: string }>(),
  ]);
  const projectIds = new Set(projectResult.results.map((row) => row.id));
  const categoryIds = new Set(categoryResult.results.map((row) => row.id));

  const templates = (Array.isArray(input.routineTemplates) ? input.routineTemplates : []).flatMap((raw) => {
    if (!isObject(raw)) return [];
    const id = text(raw.id, 120) || newId();
    const name = text(raw.name, 80);
    if (!name) return [];
    return [{ id, name, description: text(raw.description, 500) || null, createdAt: iso(raw.createdAt) || now, updatedAt: iso(raw.updatedAt) || now }];
  });
  const templateIds = new Set(templates.map((row) => row.id));

  const items = (Array.isArray(input.routineTemplateItems) ? input.routineTemplateItems : []).flatMap((raw) => {
    if (!isObject(raw)) return [];
    const routineId = text(raw.routineId, 120);
    const title = text(raw.title, 240);
    if (!templateIds.has(routineId) || !title) return [];
    const projectId = text(raw.projectId, 120);
    const categoryId = text(raw.categoryId, 120);
    const sortOrder = typeof raw.sortOrder === "number" ? Math.max(0, Math.trunc(raw.sortOrder)) : 0;
    return [{ id: text(raw.id, 120) || newId(), routineId, title, priority: priority(raw.priority), projectId: projectIds.has(projectId) ? projectId : null, categoryId: categoryIds.has(categoryId) ? categoryId : null, sortOrder, createdAt: iso(raw.createdAt) || now, updatedAt: iso(raw.updatedAt) || now }];
  });

  const runs = (Array.isArray(input.routineRuns) ? input.routineRuns : []).flatMap((raw) => {
    if (!isObject(raw)) return [];
    const routineId = text(raw.routineId, 120);
    const targetDate = date(raw.targetDate);
    if (!templateIds.has(routineId) || !targetDate) return [];
    return [{ id: text(raw.id, 120) || newId(), routineId, targetDate, createdAt: iso(raw.createdAt) || now }];
  });

  const statements = [
    c.env.DB.prepare("DELETE FROM routine_runs WHERE routine_id IN (SELECT id FROM routine_templates WHERE user_id = ?)").bind(userId),
    c.env.DB.prepare("DELETE FROM routine_template_items WHERE routine_id IN (SELECT id FROM routine_templates WHERE user_id = ?)").bind(userId),
    c.env.DB.prepare("DELETE FROM routine_templates WHERE user_id = ?").bind(userId),
    ...templates.map((row) => c.env.DB.prepare("INSERT INTO routine_templates (id, user_id, name, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)").bind(row.id, userId, row.name, row.description, row.createdAt, row.updatedAt)),
    ...items.map((row) => c.env.DB.prepare("INSERT INTO routine_template_items (id, routine_id, title, priority, project_id, category_id, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(row.id, row.routineId, row.title, row.priority, row.projectId, row.categoryId, row.sortOrder, row.createdAt, row.updatedAt)),
    ...runs.map((row) => c.env.DB.prepare("INSERT OR IGNORE INTO routine_runs (id, routine_id, target_date, created_at) VALUES (?, ?, ?, ?)").bind(row.id, row.routineId, row.targetDate, row.createdAt)),
  ];
  await c.env.DB.batch(statements);

  const payload = await c.res.clone().json() as JsonObject;
  const imported = isObject(payload.imported) ? payload.imported : {};
  replaceJson(c, { ...payload, imported: { ...imported, routineTemplates: templates.length, routineTemplateItems: items.length, routineRuns: runs.length } });
};
