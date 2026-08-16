import { Hono } from "hono";
import type { Bindings, Variables } from "../types";
import { newId, nowIso } from "../utils";

type DbRow = Record<string, string | number | null>;
type DailyPlanRef = { id: string; index: number };
type TodoTrashPayload = {
  todo: DbRow;
  tags: string[];
  memoIds: string[];
  childIds: string[];
  timeBlockIds: string[];
  focusSessionIds: string[];
  dailyPlanRefs: DailyPlanRef[];
};

type CapturedTrash = {
  trashId: string;
  originalTodoId: string;
  title: string;
  deletedAt: string;
  payload: TodoTrashPayload;
  dailyPlanUpdates: Array<{ id: string; ids: string[] }>;
};

const MAX_BULK_TRASH = 100;

const rows = async <T>(statement: D1PreparedStatement) => (await statement.all<T>()).results || [];
const strings = (value: unknown[]) => value.map(String).filter(Boolean);
const parseIds = (value: unknown) => {
  try {
    const parsed = JSON.parse(String(value || "[]"));
    return Array.isArray(parsed) ? strings(parsed) : [];
  } catch {
    return [];
  }
};

const parsePayload = (value: string): TodoTrashPayload => {
  const parsed = JSON.parse(value) as TodoTrashPayload;
  return {
    todo: parsed.todo || {},
    tags: Array.isArray(parsed.tags) ? strings(parsed.tags) : [],
    memoIds: Array.isArray(parsed.memoIds) ? strings(parsed.memoIds) : [],
    childIds: Array.isArray(parsed.childIds) ? strings(parsed.childIds) : [],
    timeBlockIds: Array.isArray(parsed.timeBlockIds) ? strings(parsed.timeBlockIds) : [],
    focusSessionIds: Array.isArray(parsed.focusSessionIds) ? strings(parsed.focusSessionIds) : [],
    dailyPlanRefs: Array.isArray(parsed.dailyPlanRefs)
      ? parsed.dailyPlanRefs.filter((item): item is DailyPlanRef => Boolean(item && typeof item.id === "string" && Number.isInteger(item.index)))
      : [],
  };
};

async function captureTodo(env: Bindings, userId: string, todoId: string): Promise<CapturedTrash | undefined> {
  const todo = await env.DB.prepare("SELECT * FROM todos WHERE id = ? AND user_id = ? LIMIT 1").bind(todoId, userId).first<DbRow>();
  if (!todo) return undefined;
  const existingTrash = await env.DB.prepare("SELECT id FROM todo_trash WHERE user_id = ? AND original_todo_id = ? LIMIT 1").bind(userId, todoId).first<{ id: string }>();
  if (existingTrash) throw new Error("이미 휴지통에 같은 Todo가 있습니다.");

  const [tagRows, memoRows, childRows, timeBlockRows, focusRows, dailyPlanRows] = await Promise.all([
    rows<{ name: string }>(env.DB.prepare("SELECT t.name FROM tags t INNER JOIN todo_tags tt ON tt.tag_id = t.id WHERE tt.todo_id = ? AND t.user_id = ? ORDER BY t.name").bind(todoId, userId)),
    rows<{ memoId: string }>(env.DB.prepare("SELECT mtl.memo_id AS memoId FROM memo_todo_links mtl INNER JOIN memos m ON m.id = mtl.memo_id WHERE mtl.todo_id = ? AND m.user_id = ?").bind(todoId, userId)),
    rows<{ id: string }>(env.DB.prepare("SELECT id FROM todos WHERE user_id = ? AND parent_todo_id = ?").bind(userId, todoId)),
    rows<{ id: string }>(env.DB.prepare("SELECT id FROM time_blocks WHERE user_id = ? AND todo_id = ?").bind(userId, todoId)),
    rows<{ id: string }>(env.DB.prepare("SELECT id FROM focus_sessions WHERE user_id = ? AND todo_id = ?").bind(userId, todoId)),
    rows<{ id: string; topTodoIdsJson: string }>(env.DB.prepare("SELECT id, top_todo_ids_json AS topTodoIdsJson FROM daily_plans WHERE user_id = ?").bind(userId)),
  ]);

  const dailyPlanRefs: DailyPlanRef[] = [];
  const dailyPlanUpdates: Array<{ id: string; ids: string[] }> = [];
  for (const plan of dailyPlanRows) {
    const ids = parseIds(plan.topTodoIdsJson);
    const index = ids.indexOf(todoId);
    if (index < 0) continue;
    dailyPlanRefs.push({ id: plan.id, index });
    dailyPlanUpdates.push({ id: plan.id, ids: ids.filter((id) => id !== todoId) });
  }

  return {
    trashId: newId(),
    originalTodoId: todoId,
    title: String(todo.title || "Todo"),
    deletedAt: nowIso(),
    payload: {
      todo,
      tags: tagRows.map((row) => row.name),
      memoIds: memoRows.map((row) => row.memoId),
      childIds: childRows.map((row) => row.id),
      timeBlockIds: timeBlockRows.map((row) => row.id),
      focusSessionIds: focusRows.map((row) => row.id),
      dailyPlanRefs,
    },
    dailyPlanUpdates,
  };
}

async function applyTrash(env: Bindings, userId: string, captured: CapturedTrash, updateDailyPlans = true) {
  const statements: D1PreparedStatement[] = [
    env.DB.prepare("INSERT INTO todo_trash (id, user_id, original_todo_id, title, payload_json, deleted_at) VALUES (?, ?, ?, ?, ?, ?)")
      .bind(captured.trashId, userId, captured.originalTodoId, captured.title, JSON.stringify(captured.payload), captured.deletedAt),
    env.DB.prepare("UPDATE todos SET parent_todo_id = NULL, updated_at = ? WHERE user_id = ? AND parent_todo_id = ?")
      .bind(captured.deletedAt, userId, captured.originalTodoId),
  ];
  if (updateDailyPlans) {
    for (const plan of captured.dailyPlanUpdates) {
      statements.push(env.DB.prepare("UPDATE daily_plans SET top_todo_ids_json = ?, updated_at = ? WHERE id = ? AND user_id = ?")
        .bind(JSON.stringify(plan.ids), captured.deletedAt, plan.id, userId));
    }
  }
  statements.push(env.DB.prepare("DELETE FROM todos WHERE id = ? AND user_id = ?").bind(captured.originalTodoId, userId));
  await env.DB.batch(statements);
}

async function trashTodo(env: Bindings, userId: string, todoId: string) {
  const captured = await captureTodo(env, userId, todoId);
  if (!captured) return undefined;
  await applyTrash(env, userId, captured);
  return captured;
}

async function loadTrash(env: Bindings, userId: string, trashId: string) {
  const row = await env.DB.prepare("SELECT id, original_todo_id AS originalTodoId, title, payload_json AS payloadJson, deleted_at AS deletedAt FROM todo_trash WHERE id = ? AND user_id = ? LIMIT 1")
    .bind(trashId, userId).first<{ id: string; originalTodoId: string; title: string; payloadJson: string; deletedAt: string }>();
  return row ? { ...row, payload: parsePayload(row.payloadJson) } : undefined;
}

async function buildRestoreState(env: Bindings, userId: string, trashId: string) {
  const trash = await loadTrash(env, userId, trashId);
  if (!trash) return undefined;
  const payload = trash.payload;
  const todo = payload.todo;
  const originalTodoId = trash.originalTodoId;
  const categoryId = todo.category_id ? String(todo.category_id) : undefined;
  const projectId = todo.project_id ? String(todo.project_id) : undefined;
  const milestoneId = todo.milestone_id ? String(todo.milestone_id) : undefined;
  const parentTodoId = todo.parent_todo_id ? String(todo.parent_todo_id) : undefined;

  const [conflict, category, project, milestone, parent] = await Promise.all([
    env.DB.prepare("SELECT id FROM todos WHERE id = ? AND user_id = ? LIMIT 1").bind(originalTodoId, userId).first<{ id: string }>(),
    categoryId ? env.DB.prepare("SELECT id FROM categories WHERE id = ? AND user_id = ? LIMIT 1").bind(categoryId, userId).first<{ id: string }>() : Promise.resolve(undefined),
    projectId ? env.DB.prepare("SELECT id FROM projects WHERE id = ? AND user_id = ? LIMIT 1").bind(projectId, userId).first<{ id: string }>() : Promise.resolve(undefined),
    milestoneId ? env.DB.prepare("SELECT id, project_id AS projectId FROM milestones WHERE id = ? AND user_id = ? LIMIT 1").bind(milestoneId, userId).first<{ id: string; projectId: string }>() : Promise.resolve(undefined),
    parentTodoId ? env.DB.prepare("SELECT id, project_id AS projectId FROM todos WHERE id = ? AND user_id = ? LIMIT 1").bind(parentTodoId, userId).first<{ id: string; projectId: string | null }>() : Promise.resolve(undefined),
  ]);

  const effectiveProjectId = project ? projectId : undefined;
  const effectiveMilestoneId = milestone && effectiveProjectId && milestone.projectId === effectiveProjectId ? milestoneId : undefined;
  const effectiveParentTodoId = parent && (!effectiveProjectId || !parent.projectId || parent.projectId === effectiveProjectId) ? parentTodoId : undefined;

  const existingChildren = payload.childIds.length
    ? await rows<{ id: string; projectId: string | null }>(env.DB.prepare(`SELECT id, project_id AS projectId FROM todos WHERE user_id = ? AND id IN (${payload.childIds.map(() => "?").join(",")})`).bind(userId, ...payload.childIds))
    : [];
  const restorableChildren = existingChildren.filter((child) => !effectiveProjectId || !child.projectId || child.projectId === effectiveProjectId).map((child) => child.id);
  const existingMemos = payload.memoIds.length
    ? await rows<{ id: string }>(env.DB.prepare(`SELECT id FROM memos WHERE user_id = ? AND id IN (${payload.memoIds.map(() => "?").join(",")})`).bind(userId, ...payload.memoIds))
    : [];
  const existingBlocks = payload.timeBlockIds.length
    ? await rows<{ id: string }>(env.DB.prepare(`SELECT id FROM time_blocks WHERE user_id = ? AND id IN (${payload.timeBlockIds.map(() => "?").join(",")})`).bind(userId, ...payload.timeBlockIds))
    : [];
  const existingSessions = payload.focusSessionIds.length
    ? await rows<{ id: string }>(env.DB.prepare(`SELECT id FROM focus_sessions WHERE user_id = ? AND id IN (${payload.focusSessionIds.map(() => "?").join(",")})`).bind(userId, ...payload.focusSessionIds))
    : [];

  const dailyPlanStates: Array<{ id: string; index: number; ids: string[]; restorable: boolean }> = [];
  for (const ref of payload.dailyPlanRefs) {
    const plan = await env.DB.prepare("SELECT top_todo_ids_json AS ids FROM daily_plans WHERE id = ? AND user_id = ? LIMIT 1").bind(ref.id, userId).first<{ ids: string }>();
    if (!plan) continue;
    const ids = parseIds(plan.ids);
    dailyPlanStates.push({ id: ref.id, index: ref.index, ids, restorable: ids.includes(originalTodoId) || ids.length < 5 });
  }

  const warnings: string[] = [];
  if (categoryId && !category) warnings.push("기존 카테고리가 없어 미분류로 복원됩니다.");
  if (projectId && !project) warnings.push("기존 프로젝트가 없어 프로젝트 연결이 해제됩니다.");
  if (milestoneId && !effectiveMilestoneId) warnings.push("기존 마일스톤을 사용할 수 없어 연결이 해제됩니다.");
  if (parentTodoId && !effectiveParentTodoId) warnings.push("기존 상위 Todo를 사용할 수 없어 연결이 해제됩니다.");
  if (payload.memoIds.length !== existingMemos.length) warnings.push("삭제 이후 사라진 메모 연결은 복원하지 않습니다.");
  if (payload.childIds.length !== restorableChildren.length) warnings.push("일부 하위 Todo 연결은 현재 프로젝트 구조와 맞지 않아 복원하지 않습니다.");
  if (dailyPlanStates.some((plan) => !plan.restorable)) warnings.push("Top Todo가 이미 5개인 일부 날짜에는 오늘 계획 연결을 복원하지 않습니다.");
  if (conflict) warnings.unshift("같은 ID의 Todo가 이미 존재해 복원할 수 없습니다.");

  return {
    trash,
    payload,
    effective: { categoryId: category ? categoryId : undefined, projectId: effectiveProjectId, milestoneId: effectiveMilestoneId, parentTodoId: effectiveParentTodoId },
    relationIds: {
      childIds: restorableChildren,
      memoIds: existingMemos.map((row) => row.id),
      timeBlockIds: existingBlocks.map((row) => row.id),
      focusSessionIds: existingSessions.map((row) => row.id),
      dailyPlans: dailyPlanStates.filter((plan) => plan.restorable),
    },
    preview: {
      id: trash.id,
      originalTodoId,
      title: trash.title,
      deletedAt: trash.deletedAt,
      restorable: !conflict,
      refs: {
        category: { requested: categoryId || null, restored: category ? categoryId : null },
        project: { requested: projectId || null, restored: effectiveProjectId || null },
        milestone: { requested: milestoneId || null, restored: effectiveMilestoneId || null },
        parentTodo: { requested: parentTodoId || null, restored: effectiveParentTodoId || null },
      },
      links: {
        children: { requested: payload.childIds.length, restored: restorableChildren.length },
        memos: { requested: payload.memoIds.length, restored: existingMemos.length },
        timeBlocks: { requested: payload.timeBlockIds.length, restored: existingBlocks.length },
        focusSessions: { requested: payload.focusSessionIds.length, restored: existingSessions.length },
        dailyPlans: { requested: payload.dailyPlanRefs.length, restored: dailyPlanStates.filter((plan) => plan.restorable).length },
      },
      warnings,
    },
  };
}

async function ensureTag(env: Bindings, userId: string, name: string) {
  const existing = await env.DB.prepare("SELECT id FROM tags WHERE user_id = ? AND name = ? LIMIT 1").bind(userId, name).first<{ id: string }>();
  if (existing) return existing.id;
  const id = newId();
  const now = nowIso();
  await env.DB.prepare("INSERT INTO tags (id, user_id, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)").bind(id, userId, name, now, now).run();
  return id;
}

async function restoreTrash(env: Bindings, userId: string, trashId: string) {
  const state = await buildRestoreState(env, userId, trashId);
  if (!state) return undefined;
  if (!state.preview.restorable) return { state, restored: false };
  const todo = state.payload.todo;
  const now = nowIso();
  const values = [
    state.trash.originalTodoId, userId, state.effective.categoryId || null, state.effective.projectId || null, state.effective.milestoneId || null, state.effective.parentTodoId || null,
    todo.title, todo.memo, todo.date, todo.due_date, todo.start_time, todo.end_time, todo.estimate_minutes,
    todo.planning_state || "SCHEDULED", todo.workflow_status || (todo.completed ? "DONE" : "TODO"), todo.priority || "MEDIUM",
    todo.completed || 0, todo.repeat || "NONE", todo.archived || 0, todo.archived_at, todo.sort_order || 0, todo.created_at || now, now,
  ];
  const statements: D1PreparedStatement[] = [
    env.DB.prepare("INSERT INTO todos (id, user_id, category_id, project_id, milestone_id, parent_todo_id, title, memo, date, due_date, start_time, end_time, estimate_minutes, planning_state, workflow_status, priority, completed, repeat, archived, archived_at, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(...values),
  ];

  for (const tag of state.payload.tags) {
    const tagId = await ensureTag(env, userId, tag);
    statements.push(env.DB.prepare("INSERT OR IGNORE INTO todo_tags (todo_id, tag_id) VALUES (?, ?)").bind(state.trash.originalTodoId, tagId));
  }
  for (const memoId of state.relationIds.memoIds) statements.push(env.DB.prepare("INSERT OR IGNORE INTO memo_todo_links (memo_id, todo_id, created_at) VALUES (?, ?, ?)").bind(memoId, state.trash.originalTodoId, now));
  for (const childId of state.relationIds.childIds) statements.push(env.DB.prepare("UPDATE todos SET parent_todo_id = ?, updated_at = ? WHERE id = ? AND user_id = ?").bind(state.trash.originalTodoId, now, childId, userId));
  for (const blockId of state.relationIds.timeBlockIds) statements.push(env.DB.prepare("UPDATE time_blocks SET todo_id = ?, updated_at = ? WHERE id = ? AND user_id = ?").bind(state.trash.originalTodoId, now, blockId, userId));
  for (const sessionId of state.relationIds.focusSessionIds) statements.push(env.DB.prepare("UPDATE focus_sessions SET todo_id = ? WHERE id = ? AND user_id = ?").bind(state.trash.originalTodoId, sessionId, userId));
  for (const plan of state.relationIds.dailyPlans) {
    if (plan.ids.includes(state.trash.originalTodoId)) continue;
    const ids = [...plan.ids];
    ids.splice(Math.min(Math.max(0, plan.index), ids.length), 0, state.trash.originalTodoId);
    statements.push(env.DB.prepare("UPDATE daily_plans SET top_todo_ids_json = ?, updated_at = ? WHERE id = ? AND user_id = ?").bind(JSON.stringify(ids.slice(0, 5)), now, plan.id, userId));
  }
  statements.push(env.DB.prepare("DELETE FROM todo_trash WHERE id = ? AND user_id = ?").bind(trashId, userId));
  await env.DB.batch(statements);
  return { state, restored: true };
}

export const trashRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>();

trashRoutes.post("/todos/:id/trash", async (c) => {
  try {
    const captured = await trashTodo(c.env, c.get("userId"), c.req.param("id"));
    return captured ? c.json({ ok: true, trashId: captured.trashId }) : c.json({ message: "Todo를 찾을 수 없습니다." }, 404);
  } catch (error) {
    return c.json({ message: error instanceof Error ? error.message : "Todo를 휴지통으로 이동하지 못했습니다." }, 409);
  }
});

trashRoutes.post("/todos/bulk-trash", async (c) => {
  const body = await c.req.json<{ ids?: unknown }>();
  const ids = Array.isArray(body.ids) ? Array.from(new Set(body.ids.filter((id): id is string => typeof id === "string").map((id) => id.trim()).filter(Boolean))) : [];
  if (!ids.length) return c.json({ message: "휴지통으로 이동할 Todo를 선택해주세요." }, 400);
  if (ids.length > MAX_BULK_TRASH) return c.json({ message: `한 번에 최대 ${MAX_BULK_TRASH}개까지 휴지통으로 이동할 수 있습니다.` }, 400);
  try {
    const captured = (await Promise.all(ids.map((id) => captureTodo(c.env, c.get("userId"), id)))).filter((item): item is CapturedTrash => Boolean(item));
    const selectedIds = new Set(captured.map((item) => item.originalTodoId));
    const ordered = [...captured].sort((a, b) => {
      if (a.payload.childIds.some((id) => id === b.originalTodoId)) return 1;
      if (b.payload.childIds.some((id) => id === a.originalTodoId)) return -1;
      return 0;
    });
    const plans = await rows<{ id: string; ids: string }>(c.env.DB.prepare("SELECT id, top_todo_ids_json AS ids FROM daily_plans WHERE user_id = ?").bind(c.get("userId")));
    for (const item of ordered) await applyTrash(c.env, c.get("userId"), item, false);
    const now = nowIso();
    const planStatements = plans.map((plan) => c.env.DB.prepare("UPDATE daily_plans SET top_todo_ids_json = ?, updated_at = ? WHERE id = ? AND user_id = ?")
      .bind(JSON.stringify(parseIds(plan.ids).filter((id) => !selectedIds.has(id))), now, plan.id, c.get("userId")));
    if (planStatements.length) await c.env.DB.batch(planStatements);
    return c.json({ ok: true, trashed: captured.length });
  } catch (error) {
    return c.json({ message: error instanceof Error ? error.message : "Todo를 휴지통으로 이동하지 못했습니다." }, 409);
  }
});

trashRoutes.get("/trash/todos", async (c) => {
  const list = await rows<{ id: string; originalTodoId: string; title: string; deletedAt: string }>(
    c.env.DB.prepare("SELECT id, original_todo_id AS originalTodoId, title, deleted_at AS deletedAt FROM todo_trash WHERE user_id = ? ORDER BY deleted_at DESC LIMIT 500").bind(c.get("userId")),
  );
  return c.json({ trashTodos: list });
});

trashRoutes.get("/trash/todos/:id/preview", async (c) => {
  const state = await buildRestoreState(c.env, c.get("userId"), c.req.param("id"));
  return state ? c.json({ preview: state.preview }) : c.json({ message: "휴지통 항목을 찾을 수 없습니다." }, 404);
});

trashRoutes.post("/trash/todos/:id/restore", async (c) => {
  const result = await restoreTrash(c.env, c.get("userId"), c.req.param("id"));
  if (!result) return c.json({ message: "휴지통 항목을 찾을 수 없습니다." }, 404);
  if (!result.restored) return c.json({ message: "현재 상태에서는 복원할 수 없습니다.", preview: result.state.preview }, 409);
  return c.json({ ok: true, todoId: result.state.trash.originalTodoId, preview: result.state.preview });
});

trashRoutes.delete("/trash/todos/:id", async (c) => {
  await c.env.DB.prepare("DELETE FROM todo_trash WHERE id = ? AND user_id = ?").bind(c.req.param("id"), c.get("userId")).run();
  return c.json({ ok: true });
});

trashRoutes.delete("/trash/todos", async (c) => {
  await c.env.DB.prepare("DELETE FROM todo_trash WHERE user_id = ?").bind(c.get("userId")).run();
  return c.json({ ok: true });
});
