import type { MiddlewareHandler } from "hono";
import { syncBlockedTodoStatus } from "./todoDependencies";
import type { Bindings, Variables } from "./types";
import { nowIso } from "./utils";

type AppEnv = { Bindings: Bindings; Variables: Variables };
type JsonObject = Record<string, unknown>;
const isObject = (value: unknown): value is JsonObject => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const text = (value: unknown, max: number) => typeof value === "string" ? value.trim().slice(0, max) : "";

const replaceJson = (c: Parameters<MiddlewareHandler<AppEnv>>[0], payload: JsonObject) => {
  const headers = new Headers(c.res.headers);
  headers.set("content-type", "application/json; charset=UTF-8");
  c.res = new Response(JSON.stringify(payload), { status: c.res.status, headers });
};

export const step5BackupExportMiddleware: MiddlewareHandler<AppEnv> = async (c, next) => {
  await next();
  if (!c.res.ok || c.req.method !== "GET") return;
  const userId = c.get("userId");
  const dependencies = await c.env.DB.prepare(`
    SELECT blocking_todo_id AS blockingTodoId, blocked_todo_id AS blockedTodoId, created_at AS createdAt
    FROM todo_dependencies WHERE user_id = ? ORDER BY created_at ASC
  `).bind(userId).all();
  const payload = await c.res.clone().json() as JsonObject;
  replaceJson(c, { ...payload, todoDependencies: dependencies.results });
};

const createsCycle = (graph: Map<string, Set<string>>, blockingId: string, blockedId: string) => {
  const queue = [blockedId];
  const visited = new Set<string>();
  while (queue.length) {
    const current = queue.shift()!;
    if (current === blockingId) return true;
    if (visited.has(current)) continue;
    visited.add(current);
    for (const next of graph.get(current) || []) queue.push(next);
  }
  return false;
};

export const step5BackupImportMiddleware: MiddlewareHandler<AppEnv> = async (c, next) => {
  let input: JsonObject = {};
  try { const value = await c.req.raw.clone().json(); if (isObject(value)) input = value; } catch { return next(); }
  await next();
  if (!c.res.ok || c.req.method !== "POST") return;

  const userId = c.get("userId");
  const todoResult = await c.env.DB.prepare("SELECT id FROM todos WHERE user_id = ?").bind(userId).all<{ id: string }>();
  const todoIds = new Set(todoResult.results.map((row) => row.id));
  const graph = new Map<string, Set<string>>();
  const rows: Array<{ blockingTodoId: string; blockedTodoId: string; createdAt: string }> = [];
  const seen = new Set<string>();
  for (const raw of Array.isArray(input.todoDependencies) ? input.todoDependencies : []) {
    if (!isObject(raw)) continue;
    const blockingTodoId = text(raw.blockingTodoId, 120);
    const blockedTodoId = text(raw.blockedTodoId, 120);
    const key = `${blockingTodoId}\u0000${blockedTodoId}`;
    if (!blockingTodoId || !blockedTodoId || blockingTodoId === blockedTodoId || seen.has(key) || !todoIds.has(blockingTodoId) || !todoIds.has(blockedTodoId)) continue;
    if (createsCycle(graph, blockingTodoId, blockedTodoId)) continue;
    seen.add(key);
    graph.set(blockingTodoId, new Set([...(graph.get(blockingTodoId) || []), blockedTodoId]));
    rows.push({ blockingTodoId, blockedTodoId, createdAt: text(raw.createdAt, 40) || nowIso() });
  }

  await c.env.DB.batch([
    c.env.DB.prepare("DELETE FROM todo_dependencies WHERE user_id = ?").bind(userId),
    ...rows.map((row) => c.env.DB.prepare("INSERT INTO todo_dependencies (user_id, blocking_todo_id, blocked_todo_id, created_at) VALUES (?, ?, ?, ?)")
      .bind(userId, row.blockingTodoId, row.blockedTodoId, row.createdAt)),
  ]);
  for (const blockedTodoId of new Set(rows.map((row) => row.blockedTodoId))) await syncBlockedTodoStatus(c.env.DB, userId, blockedTodoId);

  const payload = await c.res.clone().json() as JsonObject;
  const imported = isObject(payload.imported) ? payload.imported : {};
  replaceJson(c, { ...payload, imported: { ...imported, todoDependencies: rows.length } });
};
