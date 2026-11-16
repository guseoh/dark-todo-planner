export type ActivityDay = { date: string; count: number | null; level: number };

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
