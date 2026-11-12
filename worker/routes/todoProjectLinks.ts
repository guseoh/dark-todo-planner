import { z } from "zod";
import { nowIso } from "../utils";

const idSchema = z.string().min(1).max(200);
const linksSchema = z.object({
  projectId: idSchema.nullable(),
  milestoneId: idSchema.nullable(),
  parentTodoId: idSchema.nullable(),
});
export const detachTodoSchema = z.object({ projectId: idSchema, includeChildren: z.boolean() });
export const restoreTodoLinksSchema = z.object({
  changes: z.array(z.object({ id: idSchema, before: linksSchema, after: linksSchema })).min(1).max(500),
});
type TodoProjectLinks = z.infer<typeof linksSchema>;
type TodoProjectLinkChange = z.infer<typeof restoreTodoLinksSchema>["changes"][number];

type LinkedTodo = TodoProjectLinks & { id: string; moving: number };

export async function planTodoDetach(db: D1Database, userId: string, id: string, projectId: string, includeChildren: boolean) {
  const { results } = await db.prepare(`
    WITH RECURSIVE moving(id) AS (
      SELECT t.id FROM todos t JOIN projects p ON p.id = t.project_id
      WHERE t.user_id = ?1 AND t.id = ?2 AND p.id = ?3 AND p.user_id = ?1 AND p.archived = 0
      UNION
      SELECT t.id FROM todos t JOIN moving m ON t.parent_todo_id = m.id
      WHERE ?4 = 1 AND t.user_id = ?1 AND t.project_id = ?3
    )
    SELECT id, project_id AS projectId, milestone_id AS milestoneId, parent_todo_id AS parentTodoId,
           id IN (SELECT id FROM moving) AS moving
    FROM todos WHERE user_id = ?1 AND (id IN (SELECT id FROM moving) OR parent_todo_id IN (SELECT id FROM moving))
    LIMIT 501
  `).bind(userId, id, projectId, includeChildren ? 1 : 0).all<LinkedTodo>();
  const movingIds = new Set(results.filter((row) => row.moving).map((row) => row.id));
  return results.map(({ id, moving, ...before }): TodoProjectLinkChange => ({
    id,
    before,
    after: moving
      ? { projectId: null, milestoneId: null, parentTodoId: before.parentTodoId && movingIds.has(before.parentTodoId) ? before.parentTodoId : null }
      : { ...before, parentTodoId: null },
  }));
}

// Materialize the guard before writing so either all expected links match or
// no rows change. Only link fields are written, preserving concurrent edits.
export async function writeTodoProjectLinks(db: D1Database, userId: string, changes: TodoProjectLinkChange[], detaching: boolean) {
  if (new Set(changes.map(({ id }) => id)).size !== changes.length) return false;
  const result = await db.prepare(`
    WITH patch AS MATERIALIZED (
      SELECT json_extract(value, '$.id') AS id,
             json_extract(value, '$.before.projectId') AS old_project,
             json_extract(value, '$.before.milestoneId') AS old_milestone,
             json_extract(value, '$.before.parentTodoId') AS old_parent,
             json_extract(value, '$.after.projectId') AS project,
             json_extract(value, '$.after.milestoneId') AS milestone,
             json_extract(value, '$.after.parentTodoId') AS parent
      FROM json_each(?1)
    ), valid AS MATERIALIZED (
      SELECT NOT EXISTS (
        SELECT 1 FROM patch p
        LEFT JOIN todos t ON t.id = p.id AND t.user_id = ?2
        LEFT JOIN projects project ON project.id = p.project AND project.user_id = ?2
        LEFT JOIN projects old_project ON old_project.id = p.old_project AND old_project.user_id = ?2
        LEFT JOIN milestones milestone ON milestone.id = p.milestone AND milestone.user_id = ?2 AND milestone.project_id = p.project
        LEFT JOIN todos parent ON parent.id = p.parent AND parent.user_id = ?2
        LEFT JOIN patch parent_patch ON parent_patch.id = p.parent
        WHERE t.id IS NULL OR t.project_id IS NOT p.old_project
          OR t.milestone_id IS NOT p.old_milestone OR t.parent_todo_id IS NOT p.old_parent
          OR (p.project IS NOT NULL AND (project.id IS NULL OR (p.project IS NOT p.old_project AND project.archived = 1)))
          OR (?4 = 1 AND p.old_project IS NOT p.project AND old_project.archived = 1)
          OR (p.milestone IS NOT NULL AND milestone.id IS NULL)
          OR (p.parent IS NOT NULL AND (parent.id IS NULL OR p.parent = p.id
              OR (CASE WHEN parent_patch.id IS NULL THEN parent.project_id ELSE parent_patch.project END) IS NOT p.project))
      ) AND NOT EXISTS (
        SELECT 1 FROM todos child JOIN patch parent ON child.parent_todo_id = parent.id
        WHERE ?4 = 1 AND child.user_id = ?2 AND parent.old_project IS NOT parent.project
          AND child.id NOT IN (SELECT id FROM patch)
      ) AS ok
    )
    UPDATE todos
    SET (project_id, milestone_id, parent_todo_id, updated_at) =
        (SELECT project, milestone, parent, ?3 FROM patch WHERE patch.id = todos.id)
    WHERE user_id = ?2 AND id IN (SELECT id FROM patch) AND (SELECT ok FROM valid)
  `).bind(JSON.stringify(changes), userId, nowIso(), detaching ? 1 : 0).run();
  return result.meta.changes === changes.length;
}
