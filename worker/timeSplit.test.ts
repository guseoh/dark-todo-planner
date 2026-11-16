import { describe, expect, it } from "vitest";
import { finalizeRange, plannerDateOf, splitByPlannerDay } from "./timeSplit";

// KST 03:00 equals 18:00 UTC of the previous calendar day.
const kst = (value: string) => Date.parse(`${value}+09:00`);

describe("planner day boundary (03:00 KST)", () => {
  it("assigns early-morning hours to the previous planner day", () => {
    expect(plannerDateOf(kst("2026-11-16T02:59:00"))).toBe("2026-11-15");
    expect(plannerDateOf(kst("2026-11-16T03:00:00"))).toBe("2026-11-16");
    expect(plannerDateOf(kst("2026-11-16T23:30:00"))).toBe("2026-11-16");
  });

  it("keeps a same-day session as a single segment", () => {
    const [segment, ...rest] = splitByPlannerDay(kst("2026-11-16T09:00:00"), kst("2026-11-16T10:30:00"));
    expect(rest).toHaveLength(0);
    expect(segment).toMatchObject({ plannerDate: "2026-11-16", durationMinutes: 90 });
  });

  it("splits a late-night session at 03:00", () => {
    const segments = splitByPlannerDay(kst("2026-11-16T23:00:00"), kst("2026-11-17T04:00:00"));
    expect(segments.map((s) => [s.plannerDate, s.durationMinutes])).toEqual([["2026-11-16", 240], ["2026-11-17", 60]]);
    expect(segments[0].endedAt).toBe(segments[1].startedAt);
    expect(segments[0].endedAt).toBe(new Date(kst("2026-11-17T03:00:00")).toISOString());
  });

  it("does not create an empty segment when the session ends exactly at 03:00", () => {
    expect(splitByPlannerDay(kst("2026-11-16T22:00:00"), kst("2026-11-17T03:00:00"))).toHaveLength(1);
  });
});

describe("finalizeRange", () => {
  const start = kst("2026-11-16T09:00:00");
  it("discards accidental taps under 30 seconds", () => {
    expect(finalizeRange(start, start + 29_000)).toEqual({ segments: [], capped: false, discarded: true });
  });
  it("keeps a normal session", () => {
    const result = finalizeRange(start, start + 25 * 60_000);
    expect(result.discarded).toBe(false);
    expect(result.capped).toBe(false);
    expect(result.segments[0].durationMinutes).toBe(25);
  });
  it("caps a forgotten timer at 12 hours", () => {
    const result = finalizeRange(start, start + 30 * 3_600_000);
    expect(result.capped).toBe(true);
    expect(result.segments.reduce((sum, s) => sum + s.durationMinutes, 0)).toBe(720);
  });
});
