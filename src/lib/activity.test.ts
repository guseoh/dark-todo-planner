import { describe, expect, it } from "vitest";
import { activitySummary, getActivityWeeks, normalizeActivityDays } from "./activity";

describe("activity calendar", () => {
  it("has a chronological 365-day rolling window padded into 7-day weeks", () => {
    const v = getActivityWeeks("2026-11-09");
    expect(v.from).toBe("2025-11-10");
    expect(v.to).toBe("2026-11-09");
    expect(v.weeks[0][0].date).toBe("2025-11-09");
    expect(v.weeks[0][0].inside).toBe(false);
    expect(v.weeks[0][1]).toEqual({ date: "2025-11-10", inside: true });
    expect(v.weeks[v.weeks.length - 1]?.[1]).toEqual({ date: "2026-11-09", inside: true });
    expect(v.weeks.flat().filter((d) => d.inside)).toHaveLength(365);
  });

  it("does not present an incomplete GitHub contribution total as zero", () => {
    const stats = activitySummary([
      { date: "2026-11-08", level: 2, count: null },
      { date: "2026-11-09", level: 0, count: 0 },
    ], "2026-11-08", "2026-11-09");
    expect(stats.total).toBeNull();
    expect(stats.activeDays).toBe(1);
  });

  it("drops malformed days and duplicate dates from the API response", () => {
    const days = normalizeActivityDays([
      { date: "2026-02-30", level: 1, count: 1 },
      { date: "2026-11-09", level: 9, count: 1 },
      { date: "2026-11-09", level: 2, count: 3 },
      { date: "2026-11-08", level: 1, count: -1 },
      { date: "2026-11-07", level: 1, count: 1 },
    ]);
    expect(days.map((day) => day.date)).toEqual(["2026-11-07", "2026-11-09"]);
  });
});
