import { USER_ID } from "../auth";
import type { Bindings } from "../types";

export type TodoReminderRow = {
  id: string;
  todoId: string;
  remindAt: string;
  channel: "DISCORD";
  status: "PENDING" | "SENT" | "CANCELLED";
  sentAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type DueReminderRow = TodoReminderRow & { title: string };

export type TodoReminderRunResult = {
  status: "missing-secret" | "no-reminders" | "processed";
  due: number;
  sent: number;
  failed: number;
};

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const CLAIM_STALE_MS = 10 * 60 * 1000;

const sanitizeTitle = (title: string) => title.trim().replaceAll("@", "＠").replace(/\s+/g, " ").slice(0, 160) || "제목 없음";

export function getSnoozedReminderAt(now: Date, preset: "10m" | "30m" | "1h" | "tomorrow"): Date {
  if (preset === "10m") return new Date(now.getTime() + 10 * 60 * 1000);
  if (preset === "30m") return new Date(now.getTime() + 30 * 60 * 1000);
  if (preset === "1h") return new Date(now.getTime() + 60 * 60 * 1000);
  const korea = new Date(now.getTime() + KST_OFFSET_MS);
  const utc = Date.UTC(korea.getUTCFullYear(), korea.getUTCMonth(), korea.getUTCDate() + 1, 9, 0, 0) - KST_OFFSET_MS;
  return new Date(utc);
}

const formatKst = (value: string) => new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
}).format(new Date(value));

const sendDiscord = async (webhookUrl: string, row: DueReminderRow) => {
  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      content: [`⏰ Todo 리마인더`, `• ${sanitizeTitle(row.title)}`, `예약 ${formatKst(row.remindAt)}`].join("\n"),
      allowed_mentions: { parse: [] },
    }),
  });
  if (!response.ok) throw new Error(`Discord reminder failed (${response.status}).`);
};

const claim = async (db: D1Database, id: string, now: Date) => {
  const token = crypto.randomUUID();
  const nowIso = now.toISOString();
  const stale = new Date(now.getTime() - CLAIM_STALE_MS).toISOString();
  const result = await db.prepare(`
    UPDATE todo_reminders
    SET claim_token = ?, claimed_at = ?, updated_at = ?
    WHERE id = ? AND status = 'PENDING'
      AND (claim_token IS NULL OR claimed_at IS NULL OR claimed_at < ?)
  `).bind(token, nowIso, nowIso, id, stale).run();
  return result.meta.changes === 1 ? token : null;
};

export async function runDueTodoReminders(env: Bindings, now = new Date()): Promise<TodoReminderRunResult> {
  if (!env.DISCORD_WEBHOOK_URL) return { status: "missing-secret", due: 0, sent: 0, failed: 0 };
  const nowIso = now.toISOString();

  await env.DB.prepare(`
    UPDATE todo_reminders SET status = 'CANCELLED', claim_token = NULL, claimed_at = NULL, updated_at = ?
    WHERE user_id = ? AND status = 'PENDING' AND todo_id IN (
      SELECT id FROM todos WHERE user_id = ? AND (completed = 1 OR archived = 1)
    )
  `).bind(nowIso, USER_ID, USER_ID).run();

  const result = await env.DB.prepare(`
    SELECT r.id, r.todo_id AS todoId, r.remind_at AS remindAt, r.channel, r.status,
      r.sent_at AS sentAt, r.created_at AS createdAt, r.updated_at AS updatedAt, t.title
    FROM todo_reminders r
    JOIN todos t ON t.id = r.todo_id AND t.user_id = r.user_id
    WHERE r.user_id = ? AND r.status = 'PENDING' AND r.remind_at <= ?
      AND t.completed = 0 AND t.archived = 0
    ORDER BY r.remind_at ASC, r.created_at ASC
    LIMIT 50
  `).bind(USER_ID, nowIso).all<DueReminderRow>();

  if (!result.results.length) return { status: "no-reminders", due: 0, sent: 0, failed: 0 };
  let sent = 0;
  let failed = 0;

  for (const row of result.results) {
    const token = await claim(env.DB, row.id, now);
    if (!token) continue;
    try {
      await sendDiscord(env.DISCORD_WEBHOOK_URL, row);
      const sentAt = new Date().toISOString();
      await env.DB.prepare(`
        UPDATE todo_reminders
        SET status = 'SENT', sent_at = ?, claim_token = NULL, claimed_at = NULL, updated_at = ?
        WHERE id = ? AND claim_token = ? AND status = 'PENDING'
      `).bind(sentAt, sentAt, row.id, token).run();
      sent += 1;
    } catch (error) {
      failed += 1;
      console.error("[todo-reminder] delivery failed", error);
      await env.DB.prepare(`
        UPDATE todo_reminders SET claim_token = NULL, claimed_at = NULL, updated_at = ?
        WHERE id = ? AND claim_token = ? AND status = 'PENDING'
      `).bind(new Date().toISOString(), row.id, token).run();
    }
  }

  return { status: "processed", due: result.results.length, sent, failed };
}
