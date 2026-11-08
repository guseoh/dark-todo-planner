import { describe, expect, it } from "vitest";
import { activityLevel, activitySummary, getActivityWeeks, parseCodexActivity } from "./activity";

describe("activity calendar", () => {
  it("has a chronological 365-day rolling window padded into 7-day weeks", () => {
    const v = getActivityWeeks("2026-11-09");
    expect(v.from).toBe("2025-11-10");
    expect(v.to).toBe("2026-11-09");
    expect(v.weeks[0][0].date).toBe("2025-11-09");
    expect(v.weeks[0][0].inside).toBe(false);
    expect(v.weeks[0][1]).toEqual({ date: "2025-11-10", inside: true });
    expect(v.weeks.at(-1)?.[1]).toEqual({ date: "2026-11-09", inside: true });
    expect(v.weeks.flat().filter((d) => d.inside)).toHaveLength(365);
  });

  it("accepts only aggregate Codex counts and preserves metric units", () => {
    const sessions = parseCodexActivity(JSON.stringify({
      version: 1, source: "codex-local-sessions",
      days: [{ date: "2026-11-08", count: 3 }, { date: "2026-11-09", count: 1 }],
    }));
    expect(sessions.metric).toBe("sessions");
    expect(sessions.days[0].level).toBe(3);
    const tokens = parseCodexActivity(JSON.stringify({
      id: 7, result: { dailyUsageBuckets: [{ startDate: "2026-11-09", tokens: 350000 }] },
    }));
    expect(tokens.metric).toBe("tokens");
    expect(tokens.days[0]).toEqual({ date: "2026-11-09", count: 350000, level: 4 });
    expect(activityLevel(0, "sessions")).toBe(0);
  });

  it("rejects raw JSONL and malformed/duplicate aggregate input", () => {
    expect(() => parseCodexActivity('{"payload":{"message":"private prompt"}}')).toThrow();
    expect(() => parseCodexActivity('{"source":"codex-local-sessions","version":1,"days":[{"date":"2026-02-30","count":2}]}')).toThrow();
    expect(() => parseCodexActivity('{"source":"codex-local-sessions","version":1,"days":[{"date":"2026-11-09","count":1},{"date":"2026-11-09","count":2}]}')).toThrow();
  });

  it("does not present an incomplete GitHub contribution total as zero", () => {
    const stats = activitySummary([
      { date: "2026-11-08", level: 2, count: null },
      { date: "2026-11-09", level: 0, count: 0 },
    ], "2026-11-08", "2026-11-09");
    expect(stats.total).toBeNull();
    expect(stats.activeDays).toBe(1);
  });
});
