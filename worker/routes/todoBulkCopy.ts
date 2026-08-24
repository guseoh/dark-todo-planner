import { Hono } from "hono";
import { z } from "zod";
import type { Bindings, Variables } from "../types";
import { newId, nowIso } from "../utils";

export const todoBulkCopyRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>();

const bulkCopySchema = z.object({
  ids: z.array(z.string().trim().min(1)).min(1).max(200),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

todoBulkCopyRoutes.post("/todos/bulk-copy", async (c) => {
  const input = bulkCopySchema.parse(await c.req.json());
  const ids = Array.from(new Set(input.ids));
  const userId = c.get("userId");
  const now = nowIso();
  const statements: D1PreparedStatement[] = [];

  for (const sourceId of ids) {
    const copiedId = newId();
    statements.push(
      c.env.DB.prepare(`
        INSERT INTO todos (
          id, user_id, category_id, project_id, milestone_id, parent_todo_id,
          title, memo, reference_url, reference_label, date, due_date,
          start_time, end_time, estimate_minutes, planning_state, workflow_status,
          priority, completed, repeat, archived, archived_at, sort_order, created_at, updated_at
        )
        SELECT
          ?, user_id, category_id, project_id, milestone_id, NULL,
          title, memo, NULL, NULL, ?, due_date,
          NULL, NULL, estimate_minutes, 'SCHEDULED', 'TODO',
          priority, 0, repeat, 0, NULL, sort_order, ?, ?
        FROM todos
        WHERE id = ? AND user_id = ? AND archived = 0
      `).bind(copiedId, input.date, now, now, sourceId, userId),
      c.env.DB.prepare(`
        INSERT OR IGNORE INTO todo_tags (todo_id, tag_id)
        SELECT ?, source_tag.tag_id
        FROM todo_tags AS source_tag
        WHERE source_tag.todo_id = ?
          AND EXISTS (
            SELECT 1 FROM todos AS source_todo
            WHERE source_todo.id = ? AND source_todo.user_id = ? AND source_todo.archived = 0
          )
      `).bind(copiedId, sourceId, sourceId, userId),
    );
  }

  const results = await c.env.DB.batch(statements);
  let copied = 0;
  for (let index = 0; index < results.length; index += 2) {
    copied += results[index]?.meta.changes || 0;
  }

  return c.json({ copied, missing: ids.length - copied });
});
