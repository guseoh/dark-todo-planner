import { USER_ID } from "../auth";
import type { Bindings } from "../types";

export type ReminderTodo = {
  id: string;
  title: string;
  date: string;
  dueDate?: string | null;
  completed: boolean;
  archived: boolean;
  repeat: "NONE" | "DAILY" | "WEEKLY" | "MONTHLY" | "WEEKDAY" | "WEEKEND";
};

export type ReminderSettings = {
  reminderTodayEnabled: boolean;
  reminderOverdueEnabled: boolean;
  reminderDueSoonEnabled: boolean;
  reminderDueSoonDays: number;
};

export type DiscordReminderPayload = {
  content: string;
  allowed_mentions: { parse: [] };
};

type NotificationStore = {
  claim: (plannerDate: string, provider: "discord", now: Date) => Promise<string | null>;
  markSent: (claimId: string, now: Date) => Promise<boolean>;
  release: (claimId: string) => Promise<void>;
};

type ReminderDependencies = {
  webhookUrl?: string;
  plannerDate: string;
  now: Date;
  loadTodos: (plannerDate: string) => Promise<ReminderTodo[]>;
  store: NotificationStore;
  send: (payload: DiscordReminderPayload) => Promise<void>;
  settings?: ReminderSettings;
  logInfo?: (message: string) => void;
  logError?: (message: string) => void;
};

export type ReminderRunResult =
  | { status: "missing-secret" | "disabled" | "no-todos" | "duplicate" | "failed"; count: number }
  | { status: "sent" | "sent-unconfirmed"; count: number };

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const PLANNER_DAY_START_HOUR = 3;
const MAX_TITLES = 5;
const MAX_TITLE_LENGTH = 80;

export const DEFAULT_REMINDER_SETTINGS: ReminderSettings = {
  reminderTodayEnabled: true,
  reminderOverdueEnabled: false,
  reminderDueSoonEnabled: false,
  reminderDueSoonDays: 3,
};

const parseDateKey = (dateKey: string) => new Date(`${dateKey}T00:00:00Z`);
const addDateDays = (dateKey: string, days: number) => {
  const date = parseDateKey(dateKey);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

export function getReminderPlannerDate(now: Date): string {
  const koreaTime = new Date(now.getTime() + KST_OFFSET_MS);
  if (koreaTime.getUTCHours() < PLANNER_DAY_START_HOUR) koreaTime.setUTCDate(koreaTime.getUTCDate() - 1);
  return [koreaTime.getUTCFullYear(), String(koreaTime.getUTCMonth() + 1).padStart(2, "0"), String(koreaTime.getUTCDate()).padStart(2, "0")].join("-");
}

export function reminderTodoOccursOnDate(todo: ReminderTodo, plannerDate: string): boolean {
  if (todo.repeat === "NONE") return todo.date === plannerDate;
  if (todo.date > plannerDate) return false;
  const base = parseDateKey(todo.date);
  const target = parseDateKey(plannerDate);
  const targetDay = target.getUTCDay();
  if (todo.repeat === "DAILY") return true;
  if (todo.repeat === "WEEKLY") return base.getUTCDay() === targetDay;
  if (todo.repeat === "MONTHLY") return base.getUTCDate() === target.getUTCDate();
  if (todo.repeat === "WEEKDAY") return targetDay >= 1 && targetDay <= 5;
  return targetDay === 0 || targetDay === 6;
}

export function selectIncompleteTodoReminderTargets(
  todos: ReminderTodo[],
  plannerDate: string,
  settings: ReminderSettings = DEFAULT_REMINDER_SETTINGS,
): ReminderTodo[] {
  const dueSoonEnd = addDateDays(plannerDate, Math.max(1, settings.reminderDueSoonDays));
  return todos.filter((todo) => {
    if (todo.archived || todo.completed) return false;
    const todayTarget = settings.reminderTodayEnabled && reminderTodoOccursOnDate(todo, plannerDate);
    const overdueTarget = settings.reminderOverdueEnabled && Boolean(todo.dueDate) && todo.dueDate! < plannerDate;
    const dueSoonTarget = settings.reminderDueSoonEnabled && Boolean(todo.dueDate) && todo.dueDate! >= plannerDate && todo.dueDate! <= dueSoonEnd;
    return todayTarget || overdueTarget || dueSoonTarget;
  });
}

const sanitizeTitle = (title: string) => {
  const safe = title.trim().replaceAll("@", "＠").replace(/\s+/g, " ");
  const characters = Array.from(safe);
  return characters.length > MAX_TITLE_LENGTH ? `${characters.slice(0, MAX_TITLE_LENGTH - 1).join("")}…` : safe;
};

export function buildDiscordReminderPayload(
  todos: ReminderTodo[],
  plannerDate: string,
  heading = "📌 오늘 미완료 Todo 알림",
): DiscordReminderPayload {
  const visible = todos.slice(0, MAX_TITLES);
  const remaining = Math.max(todos.length - visible.length, 0);
  const lines = [heading, `${plannerDate} 기준 ${todos.length}개`, ...visible.map((todo) => `• ${sanitizeTitle(todo.title) || "제목 없음"}`)];
  if (remaining) lines.push(`• 외 ${remaining}개`);
  return { content: lines.join("\n"), allowed_mentions: { parse: [] } };
}

export async function executeIncompleteTodoReminder({
  webhookUrl,
  plannerDate,
  now,
  loadTodos,
  store,
  send,
  settings = DEFAULT_REMINDER_SETTINGS,
  logInfo = console.info,
  logError = console.error,
}: ReminderDependencies): Promise<ReminderRunResult> {
  if (!webhookUrl) {
    logInfo("[reminder] Discord webhook is not configured; skipping.");
    return { status: "missing-secret", count: 0 };
  }
  if (!settings.reminderTodayEnabled && !settings.reminderOverdueEnabled && !settings.reminderDueSoonEnabled) return { status: "disabled", count: 0 };
  const targets = selectIncompleteTodoReminderTargets(await loadTodos(plannerDate), plannerDate, settings);
  if (!targets.length) return { status: "no-todos", count: 0 };
  const claimId = await store.claim(plannerDate, "discord", now);
  if (!claimId) return { status: "duplicate", count: targets.length };
  const expanded = settings.reminderOverdueEnabled || settings.reminderDueSoonEnabled;
  try {
    await send(buildDiscordReminderPayload(targets, plannerDate, expanded ? "📌 Todo 리마인더" : undefined));
  } catch {
    try { await store.release(claimId); } catch { logError("[reminder] Discord notification failed and its delivery claim could not be released."); }
    logError("[reminder] Discord notification failed; it can be retried when the claim is released.");
    return { status: "failed", count: targets.length };
  }
  try {
    const recorded = await store.markSent(claimId, now);
    if (recorded) return { status: "sent", count: targets.length };
  } catch {
    // Webhook succeeded. Keep claim to suppress duplicate delivery.
  }
  logError("[reminder] Discord notification was sent, but delivery confirmation was not recorded; retries are suppressed for this planner date.");
  return { status: "sent-unconfirmed", count: targets.length };
}

export const createD1NotificationStore = (db: D1Database): NotificationStore => ({
  async claim(plannerDate, provider, now) {
    const nowIso = now.toISOString();
    await db.prepare("DELETE FROM notification_send_records WHERE planner_date < ? AND provider = ? AND status = 'PENDING'").bind(plannerDate, provider).run();
    const id = crypto.randomUUID();
    const result = await db.prepare("INSERT OR IGNORE INTO notification_send_records (id, planner_date, provider, status, sent_at, created_at, updated_at) VALUES (?, ?, ?, 'PENDING', NULL, ?, ?)").bind(id, plannerDate, provider, nowIso, nowIso).run();
    return result.meta.changes === 1 ? id : null;
  },
  async markSent(claimId, now) {
    const sentAt = now.toISOString();
    const result = await db.prepare("UPDATE notification_send_records SET status = 'SENT', sent_at = ?, updated_at = ? WHERE id = ? AND status = 'PENDING'").bind(sentAt, sentAt, claimId).run();
    return result.meta.changes === 1;
  },
  async release(claimId) { await db.prepare("DELETE FROM notification_send_records WHERE id = ? AND status = 'PENDING'").bind(claimId).run(); },
});

export const loadReminderTodos = async (db: D1Database, plannerDate: string): Promise<ReminderTodo[]> => {
  const result = await db.prepare("SELECT id, title, date, due_date AS dueDate, completed, archived, repeat FROM todos WHERE user_id = ? AND archived = 0 AND completed = 0 AND date <= ? ORDER BY date ASC, created_at ASC, id ASC").bind(USER_ID, plannerDate).all<ReminderTodo>();
  return result.results;
};

const loadExpandedReminderTodos = async (db: D1Database, plannerDate: string, dueSoonDays: number): Promise<ReminderTodo[]> => {
  const dueEnd = addDateDays(plannerDate, Math.max(1, dueSoonDays));
  const result = await db.prepare("SELECT id, title, date, due_date AS dueDate, completed, archived, repeat FROM todos WHERE user_id = ? AND archived = 0 AND completed = 0 AND (date <= ? OR due_date <= ?) ORDER BY COALESCE(due_date, date) ASC, created_at ASC, id ASC").bind(USER_ID, plannerDate, dueEnd).all<ReminderTodo>();
  return result.results;
};

const loadReminderSettings = async (db: D1Database): Promise<ReminderSettings> => {
  const row = await db.prepare("SELECT reminder_today_enabled AS reminderTodayEnabled, reminder_overdue_enabled AS reminderOverdueEnabled, reminder_due_soon_enabled AS reminderDueSoonEnabled, reminder_due_soon_days AS reminderDueSoonDays FROM planner_settings WHERE user_id = ? LIMIT 1").bind(USER_ID).first<ReminderSettings>();
  return row ? { ...DEFAULT_REMINDER_SETTINGS, ...row } : DEFAULT_REMINDER_SETTINGS;
};

const createDiscordSender = (webhookUrl: string) => async (payload: DiscordReminderPayload) => {
  const response = await fetch(webhookUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  if (!response.ok) throw new Error("Discord notification failed.");
};

export async function runDiscordIncompleteTodoReminder(env: Bindings, now = new Date()): Promise<ReminderRunResult> {
  const plannerDate = getReminderPlannerDate(now);
  const settings = await loadReminderSettings(env.DB);
  const expanded = settings.reminderOverdueEnabled || settings.reminderDueSoonEnabled;
  return executeIncompleteTodoReminder({
    webhookUrl: env.DISCORD_WEBHOOK_URL,
    plannerDate,
    now,
    settings,
    loadTodos: (date) => expanded ? loadExpandedReminderTodos(env.DB, date, settings.reminderDueSoonDays) : loadReminderTodos(env.DB, date),
    store: createD1NotificationStore(env.DB),
    send: env.DISCORD_WEBHOOK_URL ? createDiscordSender(env.DISCORD_WEBHOOK_URL) : async () => undefined,
  });
}
