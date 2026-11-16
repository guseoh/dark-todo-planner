import { describe, expect, it } from "vitest";
import { plannerPreferencesPatchSchema } from "./settingsValidation";

describe("planner preferences patch", () => {
  it("accepts a daily goal and per-project WIP limits", () => {
    const parsed = plannerPreferencesPatchSchema.parse({ dailyGoalMinutes: "240", wipLimits: { p1: { TODO: 3, IN_PROGRESS: 2 } } });
    expect(parsed.dailyGoalMinutes).toBe(240);
    expect(parsed.wipLimits).toEqual({ p1: { TODO: 3, IN_PROGRESS: 2 } });
  });

  it("allows clearing both values", () => {
    expect(plannerPreferencesPatchSchema.parse({ dailyGoalMinutes: 0, wipLimits: {} })).toEqual({ dailyGoalMinutes: 0, wipLimits: {} });
  });

  it("rejects an empty patch, out-of-range goals and non-positive limits", () => {
    expect(plannerPreferencesPatchSchema.safeParse({}).success).toBe(false);
    expect(plannerPreferencesPatchSchema.safeParse({ dailyGoalMinutes: 1441 }).success).toBe(false);
    expect(plannerPreferencesPatchSchema.safeParse({ dailyGoalMinutes: -1 }).success).toBe(false);
    expect(plannerPreferencesPatchSchema.safeParse({ wipLimits: { p1: { TODO: 0 } } }).success).toBe(false);
    expect(plannerPreferencesPatchSchema.safeParse({ wipLimits: { p1: { REVIEW: 2 } } }).success).toBe(false);
  });
});
