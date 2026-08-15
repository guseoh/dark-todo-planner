import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { Hono, type Context } from "hono";
import {
  BACKUP_KEYS as KEYS,
  BACKUP_VERSION,
  BackupFormatError,
  SUPPORTED_BACKUP_VERSIONS,
  normalizeBackupPayload,
  normalizeBackupV8Relations,
  type BackupItem as Item,
} from "../backupFormat";
import {
  categories,
  goals,
  memoProjectLinks,
  memoTodoLinks,
  memos,
  milestones,
  musicLinks,
  projectDecisions,
  projects,
  reflections,
  todos,
  topics,
} from "../db/schema";
import { serializeCategory, serializeGoal, serializeMemo, serializeMusicLink, serializeReflection, serializeTodos, serializeTopics } from "../serializers";
import type { Bindings, Variables } from "../types";
import { newId, normalizeIcon, nowIso, optional } from "../utils";

const MAX_D1_QUERIES_PER_INVOCATION = 50;
const MAX_BINDINGS_PER_STATEMENT = 90;
type SqlValue = string | number | null;

class BackupError extends Error {}
const array = (value: unknown) => Array.isArray(value) ? value.filter((item): item is Item => !!item && typeof item === "object" && !Array.isArray(item)) : [];
const enumValue = <T extends string>(value: unknown, values: readonly T[], fallback: T) => values.includes(value as T) ? value as T : fallback;
const bool = (value: unknown) => value ? 1 : 0;
const dateValue = (value: unknown, fallback: string) => typeof value === "string" && value ? value : fallback;
const tagsOf = (value: unknown) => Array.from(new Set((Array.isArray(value) ? value : []).map(String).map((tag) => tag.trim().replace(/^#/, "")).filter(Boolean)));

function addBulkInsert(env: Bindings, statements: D1PreparedStatement[], table: string, columns: readonly string[], rows: SqlValue[][]) {
  if (rows.length === 0) return;
  const rowsPerStatement = Math.max(1, Math.floor(MAX_BINDINGS_PER_STATEMENT / columns.length));
  for (let index = 0; index < rows.length; index += rowsPerStatement) {
    const chunk = rows.slice(index, index + rowsPerStatement);
    const placeholders = chunk.map(() => `(${columns.map(() => "?").join(",")})`).join(",");
    statements.push(env.DB.prepare(`INSERT INTO ${table} (${columns.join(",")}) VALUES ${placeholders}`).bind(...chunk.flat()));
  }
}

async function buildBackup(env: Bindings, userId: string) {
  const db = drizzle(env.DB);
  const [
    categoryRows,
    projectRows,
    decisionRows,
    milestoneRows,
    todoRows,
    reflectionRows,
    goalRows,
    memoRows,
    memoTodoLinkRows,
    memoProjectLinkRows,
    topicRows,
    musicRows,
  ] = await Promise.all([
    db.select().from(categories).where(eq(categories.userId, userId)),
    db.select().from(projects).where(eq(projects.userId, userId)),
    db.select().from(projectDecisions).where(eq(projectDecisions.userId, userId)),
    db.select().from(milestones).where(eq(milestones.userId, userId)),
    db.select().from(todos).where(eq(todos.userId, userId)),
    db.select().from(reflections).where(eq(reflections.userId, userId)),
    db.select().from(goals).where(eq(goals.userId, userId)),
    db.select().from(memos).where(eq(memos.userId, userId)),
    db.select({ memoId: memoTodoLinks.memoId, todoId: memoTodoLinks.todoId, createdAt: memoTodoLinks.createdAt })
      .from(memoTodoLinks)
      .innerJoin(memos, eq(memoTodoLinks.memoId, memos.id))
      .innerJoin(todos, eq(memoTodoLinks.todoId, todos.id))
      .where(and(eq(memos.userId, userId), eq(todos.userId, userId))),
    db.select({ memoId: memoProjectLinks.memoId, projectId: memoProjectLinks.projectId, createdAt: memoProjectLinks.createdAt })
      .from(memoProjectLinks)
      .innerJoin(memos, eq(memoProjectLinks.memoId, memos.id))
      .innerJoin(projects, eq(memoProjectLinks.projectId, projects.id))
      .where(and(eq(memos.userId, userId), eq(projects.userId, userId))),
    db.select().from(topics).where(eq(topics.userId, userId)),
    db.select().from(musicLinks).where(eq(musicLinks.userId, userId)),
  ]);
  const serializedTopics = await serializeTopics(db, topicRows);
  return {
    version: BACKUP_VERSION,
    exportedAt: nowIso(),
    categories: categoryRows.map(serializeCategory),
    projects: projectRows,
    projectDecisions: decisionRows,
    milestones: milestoneRows,
    todos: await serializeTodos(db, todoRows),
    reflections: reflectionRows.map(serializeReflection),
    goals: goalRows.map(serializeGoal),
    memos: memoRows.map(serializeMemo),
    memoTodoLinks: memoTodoLinkRows,
    memoProjectLinks: memoProjectLinkRows,
    topics: serializedTopics,
    topicLinks: serializedTopics.flatMap((topic) => topic.links),
    musicLinks: musicRows.map(serializeMusicLink),
  };
}

async function importBackup(env: Bindings, userId: string, input: unknown) {
  const { data, warnings } = normalizeBackupPayload(input);
  const now = nowIso();
  const imported = Object.fromEntries(KEYS.map((key) => [key, 0])) as Record<(typeof KEYS)[number], number>;

  const categoryRows: SqlValue[][] = [];
  const projectRows: SqlValue[][] = [];
  const projectDecisionRows: SqlValue[][] = [];
  const milestoneRows: SqlValue[][] = [];
  const todoRows: SqlValue[][] = [];
  const tagRows: SqlValue[][] = [];
  const todoTagRows: SqlValue[][] = [];
  const topicRows: SqlValue[][] = [];
  const topicLinkRows: SqlValue[][] = [];
  const musicRows: SqlValue[][] = [];
  const memoRows: SqlValue[][] = [];
  const memoTodoLinkRows: SqlValue[][] = [];
  const memoProjectLinkRows: SqlValue[][] = [];
  const reflectionRows: SqlValue[][] = [];
  const goalRows: SqlValue[][] = [];

  const categoryIds = new Set<string>();
  for (const item of data.categories || []) {
    if (!item.id || !item.name) continue;
    const id = String(item.id); categoryIds.add(id);
    categoryRows.push([id, userId, String(item.name), optional(item.description as string), String(item.color || "#6366f1"), normalizeIcon(item.icon as string), Number(item.order) || 0, dateValue(item.createdAt, now), dateValue(item.updatedAt, now)]);
    imported.categories++;
  }

  const projectIds = new Set<string>();
  for (const item of data.projects || []) {
    if (!item.id || !item.name) continue;
    const id = String(item.id); projectIds.add(id);
    projectRows.push([
      id, userId, String(item.name), optional(item.description as string), enumValue(item.status, ["PLANNING", "ACTIVE", "ON_HOLD", "DONE"], "ACTIVE"),
      String(item.color || "#6366f1"), normalizeIcon(item.icon as string), optional(item.startDate as string), optional(item.targetDate as string), bool(item.archived), item.archivedAt ? String(item.archivedAt) : null,
      Number(item.order) || 0, dateValue(item.createdAt, now), dateValue(item.updatedAt, now),
    ]);
    imported.projects++;
  }

  const milestoneIds = new Set<string>();
  for (const item of data.milestones || []) {
    if (!item.id || !item.projectId || !item.title || !projectIds.has(String(item.projectId))) continue;
    const id = String(item.id); milestoneIds.add(id);
    milestoneRows.push([
      id, userId, String(item.projectId), String(item.title), optional(item.description as string), optional(item.targetDate as string),
      enumValue(item.status, ["TODO", "IN_PROGRESS", "DONE"], "TODO"), Number(item.order) || 0, dateValue(item.createdAt, now), dateValue(item.updatedAt, now),
    ]);
    imported.milestones++;
  }

  const allTodoIds = new Set((data.todos || []).filter((item) => item.id).map((item) => String(item.id)));
  const todoIds = new Set<string>();
  const tagIds = new Map<string, string>();
  for (const item of data.todos || []) {
    if (!item.id || !item.title || !item.date) continue;
    const id = String(item.id);
    todoIds.add(id);
    const categoryId = item.categoryId && categoryIds.has(String(item.categoryId)) ? String(item.categoryId) : null;
    const projectId = item.projectId && projectIds.has(String(item.projectId)) ? String(item.projectId) : null;
    const milestoneId = projectId && item.milestoneId && milestoneIds.has(String(item.milestoneId)) ? String(item.milestoneId) : null;
    const parentTodoId = item.parentTodoId && allTodoIds.has(String(item.parentTodoId)) && String(item.parentTodoId) !== id ? String(item.parentTodoId) : null;
    const completed = Boolean(item.completed);
    todoRows.push([
      id, userId, categoryId, projectId, milestoneId, parentTodoId, String(item.title), optional(item.memo as string), String(item.date), optional(item.dueDate as string),
      optional(item.startTime as string), optional(item.endTime as string), item.estimateMinutes ? Math.max(1, Number(item.estimateMinutes)) : null,
      enumValue(item.planningState, ["INBOX", "SCHEDULED", "SOMEDAY", "WAITING"], "SCHEDULED"),
      completed ? "DONE" : enumValue(item.workflowStatus, ["TODO", "IN_PROGRESS", "BLOCKED", "DONE"], "TODO"),
      enumValue(item.priority, ["LOW", "MEDIUM", "HIGH"], "MEDIUM"), bool(item.completed), enumValue(item.repeat, ["NONE", "DAILY", "WEEKLY", "MONTHLY", "WEEKDAY", "WEEKEND"], "NONE"),
      bool(item.archived), item.archivedAt ? String(item.archivedAt) : null, Number(item.order) || 0, dateValue(item.createdAt, now), dateValue(item.updatedAt, now),
    ]);
    imported.todos++;
    for (const name of tagsOf(item.tags)) {
      let tagId = tagIds.get(name);
      if (!tagId) { tagId = newId(); tagIds.set(name, tagId); tagRows.push([tagId, userId, name, now, now]); }
      todoTagRows.push([id, tagId]);
    }
  }

  const topicIds = new Set<string>();
  for (const item of data.topics || []) {
    if (!item.id || !item.title) continue;
    const id = String(item.id); topicIds.add(id);
    topicRows.push([id, userId, String(item.title), optional(item.memo as string), enumValue(item.status, ["IDEA", "WRITING", "DONE"], "IDEA"), JSON.stringify(tagsOf(item.tags)), normalizeIcon(item.icon as string), dateValue(item.createdAt, now), dateValue(item.updatedAt, now)]);
    imported.topics++;
  }

  const links = new Map<string, Item>();
  const collect = (link: Item, topicId?: unknown) => { const actualTopic = link.topicId || topicId; if (!actualTopic || !link.url) return; links.set(String(link.id || `${actualTopic}:${link.url}`), { ...link, topicId: actualTopic }); };
  (data.topicLinks || []).forEach((link) => collect(link));
  (data.topics || []).forEach((topic) => array(topic.links).forEach((link) => collect(link, topic.id)));
  for (const item of links.values()) {
    const topicId = String(item.topicId); if (!topicIds.has(topicId)) continue;
    topicLinkRows.push([String(item.id || newId()), topicId, optional(item.title as string), String(item.url), optional(item.description as string), dateValue(item.createdAt, now), dateValue(item.updatedAt, now)]);
    imported.topicLinks++;
  }

  for (const item of data.musicLinks || []) {
    if (!item.id || !item.title || !item.url) continue;
    musicRows.push([String(item.id), userId, String(item.title), String(item.url), String(item.provider || "ETC"), optional(item.memo as string), dateValue(item.createdAt, now), dateValue(item.updatedAt, now)]); imported.musicLinks++;
  }

  const memoIds = new Set<string>();
  for (const item of data.memos || []) {
    if (!item.id || !item.content) continue;
    const id = String(item.id);
    memoIds.add(id);
    memoRows.push([id, userId, optional(item.title as string), String(item.content), optional(item.color as string), bool(item.pinned), dateValue(item.createdAt, now), dateValue(item.updatedAt, now)]); imported.memos++;
  }

  const relationData = normalizeBackupV8Relations(data, { projectIds, todoIds, memoIds }, now);
  for (const item of relationData.projectDecisions) {
    projectDecisionRows.push([item.id, userId, item.projectId, item.title, item.decision, item.rationale || null, item.decidedAt, item.createdAt, item.updatedAt]);
  }
  for (const item of relationData.memoTodoLinks) memoTodoLinkRows.push([item.memoId, item.todoId, item.createdAt]);
  for (const item of relationData.memoProjectLinks) memoProjectLinkRows.push([item.memoId, item.projectId, item.createdAt]);
  imported.projectDecisions = relationData.projectDecisions.length;
  imported.memoTodoLinks = relationData.memoTodoLinks.length;
  imported.memoProjectLinks = relationData.memoProjectLinks.length;
  for (const [key, count] of Object.entries(relationData.skipped)) {
    if (count > 0) warnings.push(`${key} ${count}개는 중복되었거나 연결 대상이 없어 건너뛰었습니다.`);
  }

  for (const item of data.reflections || []) {
    if (!item.id || !item.date) continue;
    const sections = Array.isArray(item.sections) ? item.sections : item.content ? [{ id: "legacy-content", title: "기존 회고", content: item.content, order: 0 }] : [];
    reflectionRows.push([String(item.id), userId, String(item.date), enumValue(item.type, ["DAILY", "WEEKLY", "MONTHLY"], "DAILY"), JSON.stringify(sections), optional(item.content as string), dateValue(item.createdAt, now), dateValue(item.updatedAt, now)]); imported.reflections++;
  }
  for (const item of data.goals || []) {
    if (!item.id || !item.title) continue;
    goalRows.push([String(item.id), userId, String(item.title), optional(item.description as string), enumValue(item.type, ["DAILY", "WEEKLY", "MONTHLY"], "DAILY"), optional((item.targetDate || item.dueDate) as string), optional(item.weekStartDate as string), optional(item.weekEndDate as string), optional(item.month as string), optional((item.dueDate || item.targetDate) as string), Math.min(100, Math.max(0, Number(item.progress) || 0)), bool(item.completed), dateValue(item.createdAt, now), dateValue(item.updatedAt, now)]); imported.goals++;
  }

  const statements: D1PreparedStatement[] = [
    env.DB.prepare("DELETE FROM topic_links WHERE topic_id IN (SELECT id FROM topics WHERE user_id = ?)").bind(userId),
    env.DB.prepare("DELETE FROM topics WHERE user_id = ?").bind(userId), env.DB.prepare("DELETE FROM music_links WHERE user_id = ?").bind(userId),
    env.DB.prepare("DELETE FROM todo_tags WHERE todo_id IN (SELECT id FROM todos WHERE user_id = ?)").bind(userId), env.DB.prepare("DELETE FROM todos WHERE user_id = ?").bind(userId),
    env.DB.prepare("DELETE FROM milestones WHERE user_id = ?").bind(userId), env.DB.prepare("DELETE FROM projects WHERE user_id = ?").bind(userId), env.DB.prepare("DELETE FROM tags WHERE user_id = ?").bind(userId),
    env.DB.prepare("DELETE FROM categories WHERE user_id = ?").bind(userId), env.DB.prepare("DELETE FROM reflections WHERE user_id = ?").bind(userId), env.DB.prepare("DELETE FROM goals WHERE user_id = ?").bind(userId), env.DB.prepare("DELETE FROM memos WHERE user_id = ?").bind(userId),
  ];

  addBulkInsert(env, statements, "categories", ["id", "user_id", "name", "description", "color", "icon", "sort_order", "created_at", "updated_at"], categoryRows);
  addBulkInsert(env, statements, "projects", ["id", "user_id", "name", "description", "status", "color", "icon", "start_date", "target_date", "archived", "archived_at", "sort_order", "created_at", "updated_at"], projectRows);
  addBulkInsert(env, statements, "project_decisions", ["id", "user_id", "project_id", "title", "decision", "rationale", "decided_at", "created_at", "updated_at"], projectDecisionRows);
  addBulkInsert(env, statements, "milestones", ["id", "user_id", "project_id", "title", "description", "target_date", "status", "sort_order", "created_at", "updated_at"], milestoneRows);
  addBulkInsert(env, statements, "todos", ["id", "user_id", "category_id", "project_id", "milestone_id", "parent_todo_id", "title", "memo", "date", "due_date", "start_time", "end_time", "estimate_minutes", "planning_state", "workflow_status", "priority", "completed", "repeat", "archived", "archived_at", "sort_order", "created_at", "updated_at"], todoRows);
  addBulkInsert(env, statements, "tags", ["id", "user_id", "name", "created_at", "updated_at"], tagRows);
  addBulkInsert(env, statements, "todo_tags", ["todo_id", "tag_id"], todoTagRows);
  addBulkInsert(env, statements, "topics", ["id", "user_id", "title", "memo", "status", "tags_json", "icon", "created_at", "updated_at"], topicRows);
  addBulkInsert(env, statements, "topic_links", ["id", "topic_id", "title", "url", "description", "created_at", "updated_at"], topicLinkRows);
  addBulkInsert(env, statements, "music_links", ["id", "user_id", "title", "url", "provider", "memo", "created_at", "updated_at"], musicRows);
  addBulkInsert(env, statements, "memos", ["id", "user_id", "title", "content", "color", "pinned", "created_at", "updated_at"], memoRows);
  addBulkInsert(env, statements, "memo_todo_links", ["memo_id", "todo_id", "created_at"], memoTodoLinkRows);
  addBulkInsert(env, statements, "memo_project_links", ["memo_id", "project_id", "created_at"], memoProjectLinkRows);
  addBulkInsert(env, statements, "reflections", ["id", "user_id", "date", "type", "sections_json", "content", "created_at", "updated_at"], reflectionRows);
  addBulkInsert(env, statements, "goals", ["id", "user_id", "title", "description", "type", "target_date", "week_start_date", "week_end_date", "month", "due_date", "progress", "completed", "created_at", "updated_at"], goalRows);

  if (statements.length > MAX_D1_QUERIES_PER_INVOCATION) throw new BackupError(`백업 데이터가 너무 커서 안전하게 가져올 수 없습니다. 필요한 쿼리 ${statements.length}개가 D1 요청 한도 ${MAX_D1_QUERIES_PER_INVOCATION}개를 초과합니다. 데이터를 나누거나 불필요한 항목을 정리한 뒤 다시 시도하세요.`);
  await env.DB.batch(statements);
  return { version: data.version ?? "legacy", latestVersion: BACKUP_VERSION, supportedVersions: [...SUPPORTED_BACKUP_VERSIONS], warnings, imported };
}

export const backupRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>();
backupRoutes.get("/backup/export", async (c) => c.json(await buildBackup(c.env, c.get("userId"))));
const handleImport = async (c: Context<{ Bindings: Bindings; Variables: Variables }>) => {
  try { return c.json({ ok: true, ...await importBackup(c.env, c.get("userId"), await c.req.json()) }); }
  catch (error) {
    if (error instanceof BackupError || error instanceof BackupFormatError) return c.json({ message: error.message }, 400);
    throw error;
  }
};
backupRoutes.post("/backup/import", handleImport);
backupRoutes.post("/migrate/local-storage", handleImport);
