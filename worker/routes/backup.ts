import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { Hono, type Context } from "hono";
import { categories, goals, memos, musicLinks, reflections, todos, topics } from "../db/schema";
import { serializeCategory, serializeGoal, serializeMemo, serializeMusicLink, serializeReflection, serializeTodos, serializeTopics } from "../serializers";
import type { Bindings, Variables } from "../types";
import { newId, normalizeIcon, nowIso, optional } from "../utils";

const BACKUP_VERSION = 6;
const KEYS = ["categories", "todos", "reflections", "goals", "memos", "topics", "topicLinks", "musicLinks"] as const;
type Item = Record<string, unknown>;
type Backup = { version?: number; exportedAt?: string } & Partial<Record<(typeof KEYS)[number], Item[]>>;

class BackupError extends Error {}
const array = (value: unknown) => Array.isArray(value) ? value.filter((item): item is Item => !!item && typeof item === "object" && !Array.isArray(item)) : [];
const normalize = (input: unknown): { data: Backup; warnings: string[] } => {
  if (Array.isArray(input)) return { data: { todos: array(input) }, warnings: ["버전 없는 Todo 배열을 legacy 백업으로 처리했습니다."] };
  if (!input || typeof input !== "object") throw new BackupError("백업 JSON은 객체 또는 Todo 배열이어야 합니다.");
  const source = input as Item; const warnings: string[] = []; const data: Backup = {};
  if (source.version != null) { const version = Number(source.version); if (Number.isInteger(version)) data.version = version; else warnings.push("백업 버전이 올바르지 않아 legacy 형식으로 처리했습니다."); }
  for (const key of KEYS) { if (source[key] != null && !Array.isArray(source[key])) warnings.push(`${key} 필드가 배열이 아니어서 건너뛰었습니다.`); data[key] = array(source[key]); }
  return { data, warnings };
};
const enumValue = <T extends string>(value: unknown, values: readonly T[], fallback: T) => values.includes(value as T) ? value as T : fallback;
const bool = (value: unknown) => value ? 1 : 0;
const dateValue = (value: unknown, fallback: string) => typeof value === "string" && value ? value : fallback;
const tagsOf = (value: unknown) => Array.from(new Set((Array.isArray(value) ? value : []).map(String).map((tag) => tag.trim().replace(/^#/, "")).filter(Boolean)));

async function buildBackup(env: Bindings, userId: string) {
  const db = drizzle(env.DB);
  const [categoryRows, todoRows, reflectionRows, goalRows, memoRows, topicRows, musicRows] = await Promise.all([
    db.select().from(categories).where(eq(categories.userId, userId)), db.select().from(todos).where(eq(todos.userId, userId)),
    db.select().from(reflections).where(eq(reflections.userId, userId)), db.select().from(goals).where(eq(goals.userId, userId)),
    db.select().from(memos).where(eq(memos.userId, userId)), db.select().from(topics).where(eq(topics.userId, userId)), db.select().from(musicLinks).where(eq(musicLinks.userId, userId)),
  ]);
  const serializedTopics = await serializeTopics(db, topicRows);
  return { version: BACKUP_VERSION, exportedAt: nowIso(), categories: categoryRows.map(serializeCategory), todos: await serializeTodos(db, todoRows), reflections: reflectionRows.map(serializeReflection), goals: goalRows.map(serializeGoal), memos: memoRows.map(serializeMemo), topics: serializedTopics, topicLinks: serializedTopics.flatMap((topic) => topic.links), musicLinks: musicRows.map(serializeMusicLink) };
}

async function importBackup(env: Bindings, userId: string, input: unknown) {
  const { data, warnings } = normalize(input); const now = nowIso(); const statements: D1PreparedStatement[] = [];
  statements.push(
    env.DB.prepare("DELETE FROM topic_links WHERE topic_id IN (SELECT id FROM topics WHERE user_id = ?)").bind(userId),
    env.DB.prepare("DELETE FROM topics WHERE user_id = ?").bind(userId), env.DB.prepare("DELETE FROM music_links WHERE user_id = ?").bind(userId),
    env.DB.prepare("DELETE FROM todo_tags WHERE todo_id IN (SELECT id FROM todos WHERE user_id = ?)").bind(userId), env.DB.prepare("DELETE FROM todos WHERE user_id = ?").bind(userId),
    env.DB.prepare("DELETE FROM tags WHERE user_id = ?").bind(userId), env.DB.prepare("DELETE FROM categories WHERE user_id = ?").bind(userId),
    env.DB.prepare("DELETE FROM reflections WHERE user_id = ?").bind(userId), env.DB.prepare("DELETE FROM goals WHERE user_id = ?").bind(userId), env.DB.prepare("DELETE FROM memos WHERE user_id = ?").bind(userId),
  );
  const imported = Object.fromEntries(KEYS.map((key) => [key, 0])) as Record<(typeof KEYS)[number], number>;
  const categoryIds = new Set<string>();
  for (const item of data.categories || []) {
    if (!item.id || !item.name) continue; const id = String(item.id); categoryIds.add(id);
    statements.push(env.DB.prepare("INSERT INTO categories (id,user_id,name,description,color,icon,sort_order,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)").bind(id, userId, String(item.name), optional(item.description as string), String(item.color || "#6366f1"), normalizeIcon(item.icon as string), Number(item.order) || 0, dateValue(item.createdAt, now), dateValue(item.updatedAt, now))); imported.categories++;
  }
  const tagIds = new Map<string, string>();
  for (const item of data.todos || []) {
    if (!item.id || !item.title || !item.date) continue; const id = String(item.id); const categoryId = item.categoryId && categoryIds.has(String(item.categoryId)) ? String(item.categoryId) : null;
    statements.push(env.DB.prepare("INSERT INTO todos (id,user_id,category_id,title,memo,date,start_time,end_time,priority,completed,repeat,archived,archived_at,sort_order,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)").bind(id,userId,categoryId,String(item.title),optional(item.memo as string),String(item.date),optional(item.startTime as string),optional(item.endTime as string),enumValue(item.priority,["LOW","MEDIUM","HIGH"],"MEDIUM"),bool(item.completed),enumValue(item.repeat,["NONE","DAILY","WEEKLY","MONTHLY","WEEKDAY","WEEKEND"],"NONE"),bool(item.archived),item.archivedAt ? String(item.archivedAt) : null,Number(item.order)||0,dateValue(item.createdAt,now),dateValue(item.updatedAt,now))); imported.todos++;
    for (const name of tagsOf(item.tags)) { let tagId = tagIds.get(name); if (!tagId) { tagId = newId(); tagIds.set(name, tagId); statements.push(env.DB.prepare("INSERT INTO tags (id,user_id,name,created_at,updated_at) VALUES (?,?,?,?,?)").bind(tagId,userId,name,now,now)); } statements.push(env.DB.prepare("INSERT INTO todo_tags (todo_id,tag_id) VALUES (?,?)").bind(id,tagId)); }
  }
  const topicIds = new Set<string>();
  for (const item of data.topics || []) { if (!item.id || !item.title) continue; const id = String(item.id); topicIds.add(id); statements.push(env.DB.prepare("INSERT INTO topics (id,user_id,title,memo,status,tags_json,icon,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)").bind(id,userId,String(item.title),optional(item.memo as string),enumValue(item.status,["IDEA","WRITING","DONE"],"IDEA"),JSON.stringify(tagsOf(item.tags)),normalizeIcon(item.icon as string),dateValue(item.createdAt,now),dateValue(item.updatedAt,now))); imported.topics++; }
  const links = new Map<string, Item>();
  const collect = (link: Item, topicId?: unknown) => { const actualTopic = link.topicId || topicId; if (!actualTopic || !link.url) return; const value = { ...link, topicId: actualTopic }; links.set(String(link.id || `${actualTopic}:${link.url}`), value); };
  (data.topicLinks || []).forEach((link) => collect(link)); (data.topics || []).forEach((topic) => array(topic.links).forEach((link) => collect(link, topic.id)));
  for (const item of links.values()) { const topicId = String(item.topicId); if (!topicIds.has(topicId)) continue; statements.push(env.DB.prepare("INSERT INTO topic_links (id,topic_id,title,url,description,created_at,updated_at) VALUES (?,?,?,?,?,?,?)").bind(String(item.id || newId()),topicId,optional(item.title as string),String(item.url),optional(item.description as string),dateValue(item.createdAt,now),dateValue(item.updatedAt,now))); imported.topicLinks++; }
  for (const item of data.musicLinks || []) { if (!item.id || !item.title || !item.url) continue; statements.push(env.DB.prepare("INSERT INTO music_links (id,user_id,title,url,provider,memo,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)").bind(String(item.id),userId,String(item.title),String(item.url),String(item.provider || "ETC"),optional(item.memo as string),dateValue(item.createdAt,now),dateValue(item.updatedAt,now))); imported.musicLinks++; }
  for (const item of data.memos || []) { if (!item.id || !item.content) continue; statements.push(env.DB.prepare("INSERT INTO memos (id,user_id,title,content,color,pinned,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)").bind(String(item.id),userId,optional(item.title as string),String(item.content),optional(item.color as string),bool(item.pinned),dateValue(item.createdAt,now),dateValue(item.updatedAt,now))); imported.memos++; }
  for (const item of data.reflections || []) { if (!item.id || !item.date) continue; const sections = Array.isArray(item.sections) ? item.sections : item.content ? [{ id: "legacy-content", title: "기존 회고", content: item.content, order: 0 }] : []; statements.push(env.DB.prepare("INSERT INTO reflections (id,user_id,date,type,sections_json,content,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)").bind(String(item.id),userId,String(item.date),enumValue(item.type,["DAILY","WEEKLY","MONTHLY"],"DAILY"),JSON.stringify(sections),optional(item.content as string),dateValue(item.createdAt,now),dateValue(item.updatedAt,now))); imported.reflections++; }
  for (const item of data.goals || []) { if (!item.id || !item.title) continue; statements.push(env.DB.prepare("INSERT INTO goals (id,user_id,title,description,type,target_date,week_start_date,week_end_date,month,due_date,progress,completed,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)").bind(String(item.id),userId,String(item.title),optional(item.description as string),enumValue(item.type,["DAILY","WEEKLY","MONTHLY"],"DAILY"),optional((item.targetDate || item.dueDate) as string),optional(item.weekStartDate as string),optional(item.weekEndDate as string),optional(item.month as string),optional((item.dueDate || item.targetDate) as string),Math.min(100,Math.max(0,Number(item.progress)||0)),bool(item.completed),dateValue(item.createdAt,now),dateValue(item.updatedAt,now))); imported.goals++; }
  await env.DB.batch(statements);
  return { version: data.version ?? "legacy", latestVersion: BACKUP_VERSION, supportedVersions: [1,2,3,4,5,6], warnings, imported };
}

export const backupRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>();
backupRoutes.get("/backup/export", async (c) => c.json(await buildBackup(c.env, c.get("userId"))));
const handleImport = async (c: Context<{ Bindings: Bindings; Variables: Variables }>) => { try { return c.json({ ok: true, ...await importBackup(c.env, c.get("userId"), await c.req.json()) }); } catch (error) { if (error instanceof BackupError) return c.json({ message: error.message }, 400); throw error; } };
backupRoutes.post("/backup/import", handleImport);
backupRoutes.post("/migrate/local-storage", handleImport);
