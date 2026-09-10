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
    statements.push(
      c.env.DB.prepare(`
        INSERT INTO todos (
          id, user_id, category_id, project_id, milestone_id, parent_todo_id,
          title, memo, reference_url, reference_label, date, due_date,
          start_time, end_time, planning_state, workflow_status,
          priority, completed, archived, archived_at, sort_order, created_at, updated_at
        )
        SELECT
          ?, user_id, category_id, project_id, milestone_id, NULL,
          title, memo, NULL, NULL, ?, due_date,
          NULL, NULL, 'SCHEDULED', 'TODO',
          priority, 0, 0, NULL, sort_order, ?, ?
        FROM todos
        WHERE id = ? AND user_id = ? AND archived = 0
      `).bind(newId(), input.date, now, now, sourceId, userId),
    );
  }

  const results = await c.env.DB.batch(statements);
  const copied = results.reduce((count, result) => count + (result.meta.changes || 0), 0);
  return c.json({ copied, missing: ids.length - copied });
});
