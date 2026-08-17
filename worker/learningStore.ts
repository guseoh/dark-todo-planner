import type { Bindings } from "./types";
import { newId, nowIso } from "./utils";
import type { z } from "zod";
import type { learningImportItemSchema } from "./learningValidation";

export type LearningItemType = "DAILY_PROBLEM" | "TECH_BLOG";
export type LearningItemStatus = "UNREAD" | "READING" | "DONE" | "SKIPPED";
export type LearningImportItem = z.infer<typeof learningImportItemSchema>;

export type LearningRow = {
  id: string;
  userId: string;
  learningDate: string;
  type: LearningItemType;
  title: string;
  summary: string | null;
  sourceUrl: string | null;
  sourceName: string | null;
  status: LearningItemStatus;
  externalKey: string;
  todoId: string | null;
  createdAt: string;
  updatedAt: string;
};

const columns = `id, user_id AS userId, learning_date AS learningDate, type, title, summary, source_url AS sourceUrl, source_name AS sourceName, status, external_key AS externalKey, todo_id AS todoId, created_at AS createdAt, updated_at AS updatedAt`;

export const listLearningItems = async (env: Bindings, userId: string, date: string) => {
  const result = await env.DB.prepare(`SELECT ${columns} FROM learning_items WHERE user_id = ? AND learning_date = ? ORDER BY CASE type WHEN 'DAILY_PROBLEM' THEN 0 ELSE 1 END, created_at DESC`)
    .bind(userId, date)
    .all<LearningRow>();
  return result.results;
};

export const findLearningItem = async (env: Bindings, userId: string, id: string) => env.DB
  .prepare(`SELECT ${columns} FROM learning_items WHERE id = ? AND user_id = ? LIMIT 1`)
  .bind(id, userId)
  .first<LearningRow>();

export const importLearningItems = async (env: Bindings, userId: string, items: LearningImportItem[]) => {
  const now = nowIso();
  await env.DB.batch(items.map((item) => env.DB.prepare(`
    INSERT INTO learning_items (id, user_id, learning_date, type, title, summary, source_url, source_name, status, external_key, todo_id, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'UNREAD', ?, NULL, ?, ?)
    ON CONFLICT(user_id, external_key) DO UPDATE SET
      learning_date = excluded.learning_date,
      type = excluded.type,
      title = excluded.title,
      summary = excluded.summary,
      source_url = excluded.source_url,
      source_name = excluded.source_name,
      updated_at = excluded.updated_at
  `).bind(
    newId(), userId, item.learningDate, item.type, item.title,
    item.summary?.trim() || null, item.sourceUrl?.trim() || null, item.sourceName?.trim() || null,
    item.externalKey, now, now,
  )));
};

export const updateLearningStatus = async (env: Bindings, userId: string, id: string, status: LearningItemStatus) => {
  await env.DB.prepare("UPDATE learning_items SET status = ?, updated_at = ? WHERE id = ? AND user_id = ?")
    .bind(status, nowIso(), id, userId)
    .run();
  return findLearningItem(env, userId, id);
};

export const deleteLearningItem = async (env: Bindings, userId: string, id: string) => {
  await env.DB.prepare("DELETE FROM learning_items WHERE id = ? AND user_id = ?").bind(id, userId).run();
};

const sourceLabel = (item: LearningRow) => {
  if (item.sourceName?.trim()) return item.sourceName.trim().slice(0, 80);
  if (item.sourceUrl) {
    try { return new URL(item.sourceUrl).hostname.replace(/^www\./, "").slice(0, 80); } catch { /* ignore */ }
  }
  return item.type === "DAILY_PROBLEM" ? "데일리 문제" : "기술 블로그";
};

export const convertLearningItemToTodo = async (env: Bindings, userId: string, item: LearningRow, date: string) => {
  if (item.todoId) {
    const existing = await env.DB.prepare("SELECT id FROM todos WHERE id = ? AND user_id = ? LIMIT 1").bind(item.todoId, userId).first<{ id: string }>();
    if (existing) return { todoId: existing.id, created: false };
  }

  const maximum = await env.DB.prepare("SELECT COALESCE(MAX(sort_order), -1) AS value FROM todos WHERE user_id = ? AND category_id IS NULL")
    .bind(userId)
    .first<{ value: number }>();
  const todoId = newId();
  const now = nowIso();

  await env.DB.batch([
    env.DB.prepare(`INSERT INTO todos (
      id, user_id, category_id, project_id, milestone_id, parent_todo_id, title, memo, reference_url, reference_label,
      date, due_date, start_time, end_time, estimate_minutes, planning_state, workflow_status, priority, completed, repeat,
      archived, archived_at, sort_order, created_at, updated_at
    ) VALUES (?, ?, NULL, NULL, NULL, NULL, ?, ?, ?, ?, ?, NULL, NULL, NULL, NULL, 'SCHEDULED', 'TODO', 'MEDIUM', 0, 'NONE', 0, NULL, ?, ?, ?)`)
      .bind(todoId, userId, item.title, item.summary, item.sourceUrl, item.sourceUrl ? sourceLabel(item) : null, date, (maximum?.value ?? -1) + 1, now, now),
    env.DB.prepare("UPDATE learning_items SET todo_id = ?, status = CASE WHEN status = 'UNREAD' THEN 'READING' ELSE status END, updated_at = ? WHERE id = ? AND user_id = ?")
      .bind(todoId, now, item.id, userId),
  ]);

  return { todoId, created: true };
};
