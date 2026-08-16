import { BACKUP_VERSION, normalizeBackupPayload, type BackupPayload } from "./backupFormat";
import type { Bindings } from "./types";
import { newId, nowIso } from "./utils";

type SqlValue = string | number | null;
type Item = Record<string, unknown>;
const MAX_BINDINGS = 90;
const MAX_STATEMENTS = 50;

const object = (value: unknown): Item => value && typeof value === "object" && !Array.isArray(value) ? value as Item : {};
const string = (value: unknown) => typeof value === "string" ? value : "";
const optional = (value: unknown) => typeof value === "string" && value ? value : null;
const bool = (value: unknown) => value ? 1 : 0;
const integer = (value: unknown, fallback = 0) => Number.isFinite(Number(value)) ? Math.trunc(Number(value)) : fallback;
const timestamp = (value: unknown, fallback: string) => typeof value === "string" && value ? value : fallback;
const parseJson = (value: unknown, fallback: unknown) => { if (typeof value !== "string") return value ?? fallback; try { return JSON.parse(value); } catch { return fallback; } };
const uniqueStrings = (value: unknown) => Array.from(new Set((Array.isArray(value) ? value : []).map(String).filter(Boolean)));
const allRows = async <T>(statement: D1PreparedStatement) => (await statement.all<T>()).results || [];
const ids = async (env: Bindings, table: string, userId: string) => new Set((await allRows<{ id: string }>(env.DB.prepare(`SELECT id FROM ${table} WHERE user_id = ?`).bind(userId))).map((row) => row.id));

function addBulkInsert(statements: D1PreparedStatement[], env: Bindings, table: string, columns: string[], rows: SqlValue[][]) {
  if (!rows.length) return;
  const perStatement = Math.max(1, Math.floor(MAX_BINDINGS / columns.length));
  for (let index = 0; index < rows.length; index += perStatement) {
    const chunk = rows.slice(index, index + perStatement);
    const placeholders = chunk.map(() => `(${columns.map(() => "?").join(",")})`).join(",");
    statements.push(env.DB.prepare(`INSERT INTO ${table} (${columns.join(",")}) VALUES ${placeholders}`).bind(...chunk.flat()));
  }
}

export async function exportRound2Backup(env: Bindings, userId: string) {
  const [dailyPlans, weeklyReviews, savedViews, taskTemplates, focusSessions, timerSettings, timeBlocks, plannerSettings, todoTrash] = await Promise.all([
    allRows<Item>(env.DB.prepare("SELECT id, date, focus_text AS focusText, top_todo_ids_json AS topTodoIdsJson, created_at AS createdAt, updated_at AS updatedAt FROM daily_plans WHERE user_id = ? ORDER BY date").bind(userId)),
    allRows<Item>(env.DB.prepare("SELECT id, week_start_date AS weekStartDate, wins, blockers, lessons, next_focus AS nextFocus, created_at AS createdAt, updated_at AS updatedAt FROM weekly_reviews WHERE user_id = ? ORDER BY week_start_date").bind(userId)),
    allRows<Item>(env.DB.prepare("SELECT id, name, query_json AS queryJson, created_at AS createdAt, updated_at AS updatedAt FROM saved_views WHERE user_id = ? ORDER BY name").bind(userId)),
    allRows<Item>(env.DB.prepare("SELECT id, name, todo_json AS todoJson, created_at AS createdAt, updated_at AS updatedAt FROM task_templates WHERE user_id = ? ORDER BY name").bind(userId)),
    allRows<Item>(env.DB.prepare("SELECT id, todo_id AS todoId, todo_title AS todoTitle, mode, duration_minutes AS durationMinutes, planner_date AS plannerDate, started_at AS startedAt, ended_at AS endedAt, completed, created_at AS createdAt FROM focus_sessions WHERE user_id = ? ORDER BY started_at").bind(userId)),
    allRows<Item>(env.DB.prepare("SELECT id, focus_minutes AS focusMinutes, short_break_minutes AS shortBreakMinutes, long_break_minutes AS longBreakMinutes, sessions_before_long_break AS sessionsBeforeLongBreak, sound_enabled AS soundEnabled, notification_enabled AS notificationEnabled, created_at AS createdAt, updated_at AS updatedAt FROM timer_settings WHERE user_id = ?").bind(userId)),
    allRows<Item>(env.DB.prepare("SELECT id, todo_id AS todoId, title, date, start_time AS startTime, end_time AS endTime, planned_minutes AS plannedMinutes, completed, created_at AS createdAt, updated_at AS updatedAt FROM time_blocks WHERE user_id = ? ORDER BY date, start_time").bind(userId)),
    allRows<Item>(env.DB.prepare("SELECT id, carry_over_enabled AS carryOverEnabled, auto_archive_completed AS autoArchiveCompleted, reminder_today_enabled AS reminderTodayEnabled, reminder_overdue_enabled AS reminderOverdueEnabled, reminder_due_soon_enabled AS reminderDueSoonEnabled, reminder_due_soon_days AS reminderDueSoonDays, created_at AS createdAt, updated_at AS updatedAt FROM planner_settings WHERE user_id = ?").bind(userId)),
    allRows<Item>(env.DB.prepare("SELECT id, original_todo_id AS originalTodoId, title, payload_json AS payloadJson, deleted_at AS deletedAt FROM todo_trash WHERE user_id = ? ORDER BY deleted_at").bind(userId)),
  ]);
  return {
    dailyPlans: dailyPlans.map((item) => ({ ...item, topTodoIdsJson: undefined, topTodoIds: uniqueStrings(parseJson(item.topTodoIdsJson, [])) })), weeklyReviews,
    savedViews: savedViews.map((item) => ({ ...item, queryJson: undefined, query: object(parseJson(item.queryJson, {})) })),
    taskTemplates: taskTemplates.map((item) => ({ ...item, todoJson: undefined, todo: object(parseJson(item.todoJson, {})) })),
    focusSessions, timerSettings, timeBlocks, plannerSettings,
    todoTrash: todoTrash.map((item) => ({ ...item, payloadJson: undefined, payload: object(parseJson(item.payloadJson, {})) })),
  };
}

export async function suspendAutoArchive(env: Bindings, userId: string): Promise<boolean | null> {
  const row = await env.DB.prepare("SELECT auto_archive_completed AS enabled FROM planner_settings WHERE user_id = ? LIMIT 1").bind(userId).first<{ enabled: number | boolean }>();
  if (!row) return null;
  const enabled = Boolean(row.enabled);
  if (enabled) await env.DB.prepare("UPDATE planner_settings SET auto_archive_completed = 0 WHERE user_id = ?").bind(userId).run();
  return enabled;
}
export async function restoreSuspendedAutoArchive(env: Bindings, userId: string, previous: boolean | null) { if (previous) await env.DB.prepare("UPDATE planner_settings SET auto_archive_completed = 1 WHERE user_id = ?").bind(userId).run(); }

export async function restoreRound2Backup(env: Bindings, userId: string, input: unknown) {
  const { data } = normalizeBackupPayload(input); const now = nowIso();
  const [todoIds, categoryIds, projectIds, milestoneIds] = await Promise.all([ids(env, "todos", userId), ids(env, "categories", userId), ids(env, "projects", userId), ids(env, "milestones", userId)]);
  const imported = { dailyPlans: 0, weeklyReviews: 0, savedViews: 0, taskTemplates: 0, focusSessions: 0, timerSettings: 0, timeBlocks: 0, plannerSettings: 0, todoTrash: 0 };
  const warnings: string[] = [];
  const statements: D1PreparedStatement[] = [
    env.DB.prepare("DELETE FROM todo_trash WHERE user_id = ?").bind(userId), env.DB.prepare("DELETE FROM time_blocks WHERE user_id = ?").bind(userId), env.DB.prepare("DELETE FROM focus_sessions WHERE user_id = ?").bind(userId),
    env.DB.prepare("DELETE FROM timer_settings WHERE user_id = ?").bind(userId), env.DB.prepare("DELETE FROM task_templates WHERE user_id = ?").bind(userId), env.DB.prepare("DELETE FROM saved_views WHERE user_id = ?").bind(userId),
    env.DB.prepare("DELETE FROM weekly_reviews WHERE user_id = ?").bind(userId), env.DB.prepare("DELETE FROM daily_plans WHERE user_id = ?").bind(userId), env.DB.prepare("DELETE FROM planner_settings WHERE user_id = ?").bind(userId),
  ];

  const dailyRows: SqlValue[][] = [];
  for (const item of data.dailyPlans || []) { if (!item.id || !item.date) continue; dailyRows.push([String(item.id), userId, String(item.date), optional(item.focusText), JSON.stringify(uniqueStrings(item.topTodoIds).filter((id) => todoIds.has(id)).slice(0, 5)), timestamp(item.createdAt, now), timestamp(item.updatedAt, now)]); imported.dailyPlans++; }
  addBulkInsert(statements, env, "daily_plans", ["id", "user_id", "date", "focus_text", "top_todo_ids_json", "created_at", "updated_at"], dailyRows);

  const reviewRows: SqlValue[][] = [];
  for (const item of data.weeklyReviews || []) { if (!item.id || !item.weekStartDate) continue; reviewRows.push([String(item.id), userId, String(item.weekStartDate), optional(item.wins), optional(item.blockers), optional(item.lessons), optional(item.nextFocus), timestamp(item.createdAt, now), timestamp(item.updatedAt, now)]); imported.weeklyReviews++; }
  addBulkInsert(statements, env, "weekly_reviews", ["id", "user_id", "week_start_date", "wins", "blockers", "lessons", "next_focus", "created_at", "updated_at"], reviewRows);

  const viewRows: SqlValue[][] = [];
  for (const item of data.savedViews || []) { if (!item.id || !string(item.name).trim()) continue; viewRows.push([String(item.id), userId, String(item.name), JSON.stringify(object(item.query)), timestamp(item.createdAt, now), timestamp(item.updatedAt, now)]); imported.savedViews++; }
  addBulkInsert(statements, env, "saved_views", ["id", "user_id", "name", "query_json", "created_at", "updated_at"], viewRows);

  const templateRows: SqlValue[][] = [];
  for (const item of data.taskTemplates || []) {
    const todo = object(item.todo); if (!item.id || !string(item.name).trim() || !string(todo.title).trim()) continue; const cleaned = { ...todo };
    if (cleaned.categoryId && !categoryIds.has(String(cleaned.categoryId))) delete cleaned.categoryId;
    if (cleaned.projectId && !projectIds.has(String(cleaned.projectId))) { delete cleaned.projectId; delete cleaned.milestoneId; delete cleaned.parentTodoId; }
    if (cleaned.milestoneId && !milestoneIds.has(String(cleaned.milestoneId))) delete cleaned.milestoneId;
    if (cleaned.parentTodoId && !todoIds.has(String(cleaned.parentTodoId))) delete cleaned.parentTodoId;
    templateRows.push([String(item.id), userId, String(item.name), JSON.stringify(cleaned), timestamp(item.createdAt, now), timestamp(item.updatedAt, now)]); imported.taskTemplates++;
  }
  addBulkInsert(statements, env, "task_templates", ["id", "user_id", "name", "todo_json", "created_at", "updated_at"], templateRows);

  const focusRows: SqlValue[][] = [];
  for (const item of data.focusSessions || []) { if (!item.id || !item.startedAt || !item.endedAt) continue; const todoId = item.todoId && todoIds.has(String(item.todoId)) ? String(item.todoId) : null; focusRows.push([String(item.id), userId, todoId, optional(item.todoTitle), ["FOCUS", "SHORT_BREAK", "LONG_BREAK"].includes(String(item.mode)) ? String(item.mode) : "FOCUS", Math.max(1, integer(item.durationMinutes, 1)), String(item.plannerDate || String(item.startedAt).slice(0, 10)), String(item.startedAt), String(item.endedAt), bool(item.completed ?? true), timestamp(item.createdAt, now)]); imported.focusSessions++; }
  addBulkInsert(statements, env, "focus_sessions", ["id", "user_id", "todo_id", "todo_title", "mode", "duration_minutes", "planner_date", "started_at", "ended_at", "completed", "created_at"], focusRows);

  const timer = (data.timerSettings || [])[0];
  if (timer) { statements.push(env.DB.prepare("INSERT INTO timer_settings (id, user_id, focus_minutes, short_break_minutes, long_break_minutes, sessions_before_long_break, sound_enabled, notification_enabled, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(String(timer.id || newId()), userId, Math.max(1, integer(timer.focusMinutes, 25)), Math.max(1, integer(timer.shortBreakMinutes, 5)), Math.max(1, integer(timer.longBreakMinutes, 15)), Math.max(1, integer(timer.sessionsBeforeLongBreak, 4)), bool(timer.soundEnabled ?? true), bool(timer.notificationEnabled), timestamp(timer.createdAt, now), timestamp(timer.updatedAt, now))); imported.timerSettings = 1; }

  const blockRows: SqlValue[][] = [];
  for (const item of data.timeBlocks || []) { if (!item.id || !item.title || !item.date || !item.startTime || !item.endTime) continue; blockRows.push([String(item.id), userId, item.todoId && todoIds.has(String(item.todoId)) ? String(item.todoId) : null, String(item.title), String(item.date), String(item.startTime), String(item.endTime), Math.max(1, integer(item.plannedMinutes, 1)), bool(item.completed), timestamp(item.createdAt, now), timestamp(item.updatedAt, now)]); imported.timeBlocks++; }
  addBulkInsert(statements, env, "time_blocks", ["id", "user_id", "todo_id", "title", "date", "start_time", "end_time", "planned_minutes", "completed", "created_at", "updated_at"], blockRows);

  const settings = (data.plannerSettings || [])[0];
  if (settings) { statements.push(env.DB.prepare("INSERT INTO planner_settings (id, user_id, carry_over_enabled, auto_archive_completed, reminder_today_enabled, reminder_overdue_enabled, reminder_due_soon_enabled, reminder_due_soon_days, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(String(settings.id || newId()), userId, bool(settings.carryOverEnabled), bool(settings.autoArchiveCompleted), bool(settings.reminderTodayEnabled ?? true), bool(settings.reminderOverdueEnabled), bool(settings.reminderDueSoonEnabled), Math.min(14, Math.max(1, integer(settings.reminderDueSoonDays, 3))), timestamp(settings.createdAt, now), timestamp(settings.updatedAt, now))); imported.plannerSettings = 1; }

  const trashRows: SqlValue[][] = []; const trashKeys = new Set<string>();
  for (const item of data.todoTrash || []) { const originalTodoId = string(item.originalTodoId); if (!item.id || !originalTodoId || !item.title || !item.deletedAt || trashKeys.has(originalTodoId)) continue; trashKeys.add(originalTodoId); trashRows.push([String(item.id), userId, originalTodoId, String(item.title), JSON.stringify(object(item.payload)), String(item.deletedAt)]); imported.todoTrash++; }
  addBulkInsert(statements, env, "todo_trash", ["id", "user_id", "original_todo_id", "title", "payload_json", "deleted_at"], trashRows);

  if (statements.length > MAX_STATEMENTS) throw new Error(`v${BACKUP_VERSION} 확장 데이터 복원에 필요한 쿼리 ${statements.length}개가 안전 한도 ${MAX_STATEMENTS}개를 초과합니다.`);
  await env.DB.batch(statements); return { imported, warnings };
}

export const mergeRound2Backup = (base: Item, round2: Awaited<ReturnType<typeof exportRound2Backup>>) => ({ ...base, version: BACKUP_VERSION, ...round2 });
export const normalizeRound2Input = (input: unknown): BackupPayload => normalizeBackupPayload(input).data;
