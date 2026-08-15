import { eq, inArray } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { categories, memos, memoProjectLinks, memoTodoLinks, tags, todoTags, todos, topicLinks, topics } from "./db/schema";
import { parseJsonArray } from "./utils";

export type Db = DrizzleD1Database;
export const serializeCategory = (row: typeof categories.$inferSelect) => row;

export async function serializeTodos(db: Db, rows: Array<typeof todos.$inferSelect>) {
  if (!rows.length) return [];
  const ids = rows.map((row) => row.id);
  const categoryIds = Array.from(new Set(rows.map((row) => row.categoryId).filter((id): id is string => !!id)));
  const [categoryRows, tagRows] = await Promise.all([
    categoryIds.length ? db.select().from(categories).where(inArray(categories.id, categoryIds)) : [],
    db.select({ todoId: todoTags.todoId, name: tags.name }).from(todoTags).innerJoin(tags, eq(todoTags.tagId, tags.id)).where(inArray(todoTags.todoId, ids)),
  ]);
  const categoryMap = new Map(categoryRows.map((row) => [row.id, serializeCategory(row)]));
  const tagMap = new Map<string, string[]>();
  tagRows.forEach(({ todoId, name }) => tagMap.set(todoId, [...(tagMap.get(todoId) || []), name]));
  return rows.map((row) => ({
    ...row,
    categoryId: row.categoryId || undefined,
    projectId: row.projectId || undefined,
    milestoneId: row.milestoneId || undefined,
    parentTodoId: row.parentTodoId || undefined,
    memo: row.memo || undefined,
    dueDate: row.dueDate || undefined,
    startTime: row.startTime || undefined,
    endTime: row.endTime || undefined,
    estimateMinutes: row.estimateMinutes || undefined,
    archivedAt: row.archivedAt || undefined,
    tags: tagMap.get(row.id) || [],
    category: row.categoryId ? categoryMap.get(row.categoryId) : undefined,
  }));
}

export const serializeReflection = (row: { sectionsJson: string; content: string | null } & Record<string, unknown>) => ({
  ...row,
  sectionsJson: undefined,
  content: row.content || undefined,
  sections: parseJsonArray(row.sectionsJson),
});

export const serializeGoal = (row: Record<string, unknown>) => Object.fromEntries(Object.entries(row).map(([key, value]) => [key, value === null ? undefined : value]));
export const serializeMemo = serializeGoal;

export async function serializeMemos(db: Db, rows: Array<typeof memos.$inferSelect>) {
  if (!rows.length) return [];
  const ids = rows.map((row) => row.id);
  const [todoLinks, projectLinks] = await Promise.all([
    db.select().from(memoTodoLinks).where(inArray(memoTodoLinks.memoId, ids)),
    db.select().from(memoProjectLinks).where(inArray(memoProjectLinks.memoId, ids)),
  ]);
  const todoMap = new Map<string, string[]>();
  const projectMap = new Map<string, string[]>();
  todoLinks.forEach((link) => todoMap.set(link.memoId, [...(todoMap.get(link.memoId) || []), link.todoId]));
  projectLinks.forEach((link) => projectMap.set(link.memoId, [...(projectMap.get(link.memoId) || []), link.projectId]));
  return rows.map((row) => ({
    ...serializeMemo(row),
    todoIds: todoMap.get(row.id) || [],
    projectIds: projectMap.get(row.id) || [],
  }));
}

export const serializeMusicLink = (row: Record<string, unknown>) => ({ ...serializeGoal(row), provider: row.provider || "ETC" });
export const serializeTopicLink = serializeGoal;

export async function serializeTopics(db: Db, rows: Array<typeof topics.$inferSelect>) {
  if (!rows.length) return [];
  const links = await db.select().from(topicLinks).where(inArray(topicLinks.topicId, rows.map((row) => row.id))).orderBy(topicLinks.createdAt);
  const linkMap = new Map<string, Array<Record<string, unknown>>>();
  links.forEach((link) => linkMap.set(link.topicId, [...(linkMap.get(link.topicId) || []), serializeTopicLink(link)]));
  return rows.map((row) => ({
    ...row,
    tagsJson: undefined,
    memo: row.memo || undefined,
    icon: row.icon || undefined,
    tags: parseJsonArray(row.tagsJson).map(String),
    links: linkMap.get(row.id) || [],
  }));
}
