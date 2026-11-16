/**
 * Planner days start at 03:00 Korea time (UTC+9, no DST), matching the client's
 * PLANNER_DAY_START_HOUR and the Discord reminder. A tracked session that crosses
 * 03:00 is stored as one row per planner day so every row belongs to exactly one day.
 */
const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;
const KST_OFFSET_MS = 9 * HOUR_MS;
const PLANNER_DAY_START_HOUR = 3;
/** Shifting by this amount makes a planner day line up with a UTC calendar day. */
const SHIFT_MS = KST_OFFSET_MS - PLANNER_DAY_START_HOUR * HOUR_MS;

export const MAX_SESSION_MS = 12 * HOUR_MS;
export const MIN_SESSION_MS = 30_000;

export type SessionSegment = { startedAt: string; endedAt: string; plannerDate: string; durationMinutes: number };

export const plannerDateOf = (ms: number) => new Date(ms + SHIFT_MS).toISOString().slice(0, 10);
const nextBoundary = (ms: number) => (Math.floor((ms + SHIFT_MS) / DAY_MS) + 1) * DAY_MS - SHIFT_MS;

export function splitByPlannerDay(startMs: number, endMs: number): SessionSegment[] {
  const segments: SessionSegment[] = [];
  let cursor = startMs;
  while (cursor < endMs) {
    const segmentEnd = Math.min(endMs, nextBoundary(cursor));
    segments.push({
      startedAt: new Date(cursor).toISOString(),
      endedAt: new Date(segmentEnd).toISOString(),
      plannerDate: plannerDateOf(cursor),
      durationMinutes: Math.max(1, Math.round((segmentEnd - cursor) / 60_000)),
    });
    cursor = segmentEnd;
  }
  return segments;
}

/** Caps a forgotten timer and drops accidental taps. */
export function finalizeRange(startMs: number, nowMs: number): { segments: SessionSegment[]; capped: boolean; discarded: boolean } {
  const elapsed = Math.max(0, nowMs - startMs);
  if (elapsed < MIN_SESSION_MS) return { segments: [], capped: false, discarded: true };
  const capped = elapsed > MAX_SESSION_MS;
  return { segments: splitByPlannerDay(startMs, startMs + Math.min(elapsed, MAX_SESSION_MS)), capped, discarded: false };
}
