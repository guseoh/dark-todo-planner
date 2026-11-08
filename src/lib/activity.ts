export type ActivityDay = { date: string; count: number | null; level: number };
export type ActivityMetric = "sessions" | "tokens";
export type CodexActivity = {
  source: "codex-local-sessions" | "codex-app-server";
  metric: ActivityMetric;
  days: ActivityDay[];
  importedAt: string;
};
export const CODEX_ACTIVITY_KEY = "dark-todo-planner:codex-activity:v1";
const DAY_MS = 86_400_000;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const asDateMs = (key: string) => {
  if (!DATE_RE.test(key)) return Number.NaN;
  const d = Date.parse(key + "T00:00:00.000Z");
  return Number.isFinite(d) && new Date(d).toISOString().slice(0, 10) === key ? d : Number.NaN;
};
const utcKey = (ms: number) => new Date(ms).toISOString().slice(0, 10);

export function localActivityDate(now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return String(now.getFullYear()) + "-" + pad(now.getMonth() + 1) + "-" + pad(now.getDate());
}

export function getActivityWeeks(today = localActivityDate()) {
  const end = asDateMs(today);
  if (!Number.isFinite(end)) throw new Error("Invalid activity calendar date");
  const start = end - 364 * DAY_MS;
  const calendarStart = start - new Date(start).getUTCDay() * DAY_MS;
  const calendarEnd = end + (6 - new Date(end).getUTCDay()) * DAY_MS;
  const weeks: Array<Array<{ date: string; inside: boolean }>> = [];
  for (let w = calendarStart; w <= calendarEnd; w += 7 * DAY_MS) {
    const days = Array.from({ length: 7 }, (_, offset) => {
      const dateMs = w + offset * DAY_MS;
      return { date: utcKey(dateMs), inside: dateMs >= start && dateMs <= end };
    });
    weeks.push(days);
  }
  return { from: utcKey(start), to: today, weeks };
}

export function normalizeActivityDays(days: ActivityDay[]): ActivityDay[] {
  const byDate = new Map<string, ActivityDay>();
  for (const day of days) {
    if (!Number.isFinite(asDateMs(day.date)) || !Number.isInteger(day.level) || day.level < 0 || day.level > 4) continue;
    if (day.count !== null && (!Number.isSafeInteger(day.count) || day.count < 0)) continue;
    byDate.set(day.date, day);
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export function activityLevel(value: number, metric: ActivityMetric): number {
  if (value <= 0) return 0;
  const limits = metric === "tokens" ? [25_000, 100_000, 300_000] : [1, 2, 4];
  return value <= limits[0] ? 1 : value <= limits[1] ? 2 : value <= limits[2] ? 3 : 4;
}

export function parseCodexActivity(raw: string, now = new Date()): CodexActivity {
  if (raw.length > 250_000) throw new Error("집계 파일은 250KB 이하여야 합니다.");
  let payload: unknown;
  try { payload = JSON.parse(raw); } catch { throw new Error("JSON 형식의 날짜별 집계 파일을 선택해 주세요."); }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new Error("지원하지 않는 Codex 데이터 형식입니다.");
  const obj = payload as Record<string, unknown>;
  let source: CodexActivity["source"];
  let metric: ActivityMetric;
  let rows: unknown;
  if (obj.source === "codex-local-sessions" && obj.version === 1) {
    source = "codex-local-sessions"; metric = "sessions"; rows = obj.days;
  } else {
    const rpc = obj.result && typeof obj.result === "object" ? obj.result as Record<string, unknown> : obj;
    if (!Array.isArray(rpc.dailyUsageBuckets)) throw new Error("Codex 세션 집계 또는 account/usage/read 결과만 가져올 수 있습니다.");
    source = "codex-app-server"; metric = "tokens"; rows = rpc.dailyUsageBuckets;
  }
  if (!Array.isArray(rows) || rows.length > 800) throw new Error("날짜별 집계는 800일 이하여야 합니다.");
  const byDate = new Map<string, number>();
  for (const row of rows) {
    if (!row || typeof row !== "object" || Array.isArray(row)) throw new Error("집계 행이 올바르지 않습니다.");
    const item = row as Record<string, unknown>;
    const date = source === "codex-app-server" ? item.startDate : item.date;
    const count = source === "codex-app-server" ? item.tokens : item.count;
    if (typeof date !== "string" || !Number.isFinite(asDateMs(date)) ||
      typeof count !== "number" || !Number.isSafeInteger(count) || count < 0) {
      throw new Error("날짜와 활동 수는 올바른 YYYY-MM-DD, 0 이상의 정수여야 합니다.");
    }
    if (byDate.has(date)) throw new Error("같은 날짜가 중복된 집계 파일입니다.");
    byDate.set(date, count);
  }
  const days = [...byDate.entries()].map(([date, count]) => ({ date, count, level: activityLevel(count, metric) }));
  return { source, metric, days: normalizeActivityDays(days), importedAt: now.toISOString() };
}

export function activitySummary(days: ActivityDay[], from: string, to: string) {
  const valid = days.filter((day) => day.date >= from && day.date <= to);
  const activeDays = valid.filter((day) => day.level > 0).length;
  const exact = valid.every((day) => day.count !== null);
  return {
    activeDays,
    total: exact ? valid.reduce((sum, day) => sum + (day.count ?? 0), 0) : null,
    countKnown: exact,
  };
}
