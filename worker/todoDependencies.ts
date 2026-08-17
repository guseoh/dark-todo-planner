import { nowIso } from "./utils";

const STATUS_SYNC_CHUNK = 80;

export const normalizeDependencyIds = (values: unknown): string[] => {
  if (!Array.isArray(values)) return [];
  return Array.from(new Set(values.filter((value): value is string => typeof value === "string").map((value) => value.trim()).filter(Boolean))).slice(0, 20);
};

type DependencySelection = {
  ids: string[];
  previousCount: number;
  unresolvedCount: number;
};

export async function inspectDependencySelection(db: D1Database, userId: string, blockedTodoId: string, values: unknown): Promise<DependencySelection> {
  const ids = normalizeDependencyIds(values);
  if (ids.includes(blockedTodoId)) throw new Error("Todo는 자기 자신에게 의존할 수 없습니다.");

  const previous = await db.prepare("SELECT COUNT(*) AS value FROM todo_dependencies WHERE user_id = ? AND blocked_todo_id = ?")
    .bind(userId, blockedTodoId).first<{ value: number }>();

  if (!ids.length) return { ids, previousCount: Number(previous?.value || 0), unresolvedCount: 0 };

  const placeholders = ids.map(() => "?").join(",");
  const found = await db.prepare(`SELECT id FROM todos WHERE user_id = ? AND id IN (${placeholders})`)
    .bind(userId, ...ids).all<{ id: string }>();
  if (found.results.length !== ids.length) throw new Error("의존 대상으로 선택한 Todo를 찾을 수 없습니다.");

  const cycle = await db.prepare(`
    WITH RECURSIVE descendants(id) AS (
      SELECT blocked_todo_id FROM todo_dependencies WHERE user_id = ? AND blocking_todo_id = ?
      UNION
      SELECT d.blocked_todo_id
      FROM todo_dependencies d
      INNER JOIN descendants x ON d.blocking_todo_id = x.id
      WHERE d.user_id = ?
    )
    SELECT id FROM descendants WHERE id IN (${placeholders}) LIMIT 1
  `).bind(userId, blockedTodoId, userId, ...ids).first<{ id: string }>();
  if (cycle) throw new Error("Todo 의존 관계는 순환 구조로 만들 수 없습니다.");

  const unresolved = await db.prepare(`
    SELECT COUNT(*) AS value
    FROM todos
    WHERE user_id = ? AND id IN (${placeholders}) AND completed = 0 AND workflow_status <> 'DONE'
  `).bind(userId, ...ids).first<{ value: number }>();

  return { ids, previousCount: Number(previous?.value || 0), unresolvedCount: Number(unresolved?.value || 0) };
}

export async function replaceTodoDependencies(db: D1Database, userId: string, blockedTodoId: string, ids: string[]) {
  const now = nowIso();
  const statements: D1PreparedStatement[] = [
    db.prepare("DELETE FROM todo_dependencies WHERE user_id = ? AND blocked_todo_id = ?").bind(userId, blockedTodoId),
  ];
  for (const blockingTodoId of ids) {
    statements.push(db.prepare("INSERT INTO todo_dependencies (user_id, blocking_todo_id, blocked_todo_id, created_at) VALUES (?, ?, ?, ?)")
      .bind(userId, blockingTodoId, blockedTodoId, now));
  }
  await db.batch(statements);
}

async function unresolvedBlockerCount(db: D1Database, userId: string, blockedTodoId: string) {
  const row = await db.prepare(`
    SELECT COUNT(*) AS value
    FROM todo_dependencies d
    INNER JOIN todos blocker ON blocker.id = d.blocking_todo_id
    WHERE d.user_id = ? AND d.blocked_todo_id = ? AND blocker.completed = 0 AND blocker.workflow_status <> 'DONE'
  `).bind(userId, blockedTodoId).first<{ value: number }>();
  return Number(row?.value || 0);
}

export async function syncBlockedTodoStatus(db: D1Database, userId: string, blockedTodoId: string) {
  const todo = await db.prepare("SELECT completed, workflow_status AS workflowStatus FROM todos WHERE user_id = ? AND id = ? LIMIT 1")
    .bind(userId, blockedTodoId).first<{ completed: number; workflowStatus: string }>();
  if (!todo || todo.completed) return;

  const unresolved = await unresolvedBlockerCount(db, userId, blockedTodoId);
  if (unresolved > 0 && todo.workflowStatus !== "BLOCKED") {
    await db.prepare("UPDATE todos SET workflow_status = 'BLOCKED', updated_at = ? WHERE user_id = ? AND id = ?")
      .bind(nowIso(), userId, blockedTodoId).run();
  } else if (unresolved === 0 && todo.workflowStatus === "BLOCKED") {
    await db.prepare("UPDATE todos SET workflow_status = 'TODO', updated_at = ? WHERE user_id = ? AND id = ?")
      .bind(nowIso(), userId, blockedTodoId).run();
  }
}

export async function syncStatusesForChangedTodos(db: D1Database, userId: string, todoIds: string[]) {
  const ids = Array.from(new Set(todoIds.map((id) => id.trim()).filter(Boolean)));
  const now = nowIso();
  const statements: D1PreparedStatement[] = [];
  for (let index = 0; index < ids.length; index += STATUS_SYNC_CHUNK) {
    const chunk = ids.slice(index, index + STATUS_SYNC_CHUNK);
    const placeholders = chunk.map(() => "?").join(",");

    statements.push(db.prepare(`
      UPDATE todos
      SET workflow_status = CASE
        WHEN EXISTS (
          SELECT 1 FROM todo_dependencies d
          INNER JOIN todos blocker ON blocker.id = d.blocking_todo_id
          WHERE d.user_id = ? AND d.blocked_todo_id = todos.id AND blocker.completed = 0 AND blocker.workflow_status <> 'DONE'
        ) THEN 'BLOCKED'
        WHEN workflow_status = 'BLOCKED' THEN 'TODO'
        ELSE workflow_status
      END,
      updated_at = ?
      WHERE user_id = ? AND completed = 0 AND id IN (${placeholders})
        AND EXISTS (SELECT 1 FROM todo_dependencies own_d WHERE own_d.user_id = ? AND own_d.blocked_todo_id = todos.id)
    `).bind(userId, now, userId, ...chunk, userId));

    statements.push(db.prepare(`
      UPDATE todos
      SET workflow_status = CASE
        WHEN EXISTS (
          SELECT 1 FROM todo_dependencies d
          INNER JOIN todos blocker ON blocker.id = d.blocking_todo_id
          WHERE d.user_id = ? AND d.blocked_todo_id = todos.id AND blocker.completed = 0 AND blocker.workflow_status <> 'DONE'
        ) THEN 'BLOCKED'
        WHEN workflow_status = 'BLOCKED' THEN 'TODO'
        ELSE workflow_status
      END,
      updated_at = ?
      WHERE user_id = ? AND completed = 0
        AND EXISTS (
          SELECT 1 FROM todo_dependencies changed
          WHERE changed.user_id = ? AND changed.blocking_todo_id IN (${placeholders}) AND changed.blocked_todo_id = todos.id
        )
    `).bind(userId, now, userId, userId, ...chunk));
  }
  if (statements.length) await db.batch(statements);
}

export async function syncKnownBlockedTodos(db: D1Database, userId: string, blockedTodoIds: string[]) {
  const ids = Array.from(new Set(blockedTodoIds.map((id) => id.trim()).filter(Boolean)));
  const now = nowIso();
  const statements: D1PreparedStatement[] = [];
  for (let index = 0; index < ids.length; index += STATUS_SYNC_CHUNK) {
    const chunk = ids.slice(index, index + STATUS_SYNC_CHUNK);
    const placeholders = chunk.map(() => "?").join(",");
    statements.push(db.prepare(`
      UPDATE todos
      SET workflow_status = CASE
        WHEN EXISTS (
          SELECT 1 FROM todo_dependencies d
          INNER JOIN todos blocker ON blocker.id = d.blocking_todo_id
          WHERE d.user_id = ? AND d.blocked_todo_id = todos.id AND blocker.completed = 0 AND blocker.workflow_status <> 'DONE'
        ) THEN 'BLOCKED'
        WHEN workflow_status = 'BLOCKED' THEN 'TODO'
        ELSE workflow_status
      END,
      updated_at = ?
      WHERE user_id = ? AND completed = 0 AND id IN (${placeholders})
    `).bind(userId, now, userId, ...chunk));
  }
  if (statements.length) await db.batch(statements);
}

export async function syncDependentsForBlocker(db: D1Database, userId: string, blockingTodoId: string) {
  await syncStatusesForChangedTodos(db, userId, [blockingTodoId]);
}

export async function listTodoBlockers(db: D1Database, userId: string, blockedTodoId: string) {
  const result = await db.prepare(`
    SELECT blocker.id, blocker.title, blocker.completed, blocker.workflow_status AS workflowStatus
    FROM todo_dependencies d
    INNER JOIN todos blocker ON blocker.id = d.blocking_todo_id
    WHERE d.user_id = ? AND d.blocked_todo_id = ?
    ORDER BY blocker.completed ASC, blocker.updated_at DESC, blocker.title ASC
  `).bind(userId, blockedTodoId).all<{ id: string; title: string; completed: number; workflowStatus: string }>();
  return result.results.map((row) => ({ ...row, completed: Boolean(row.completed) }));
}
