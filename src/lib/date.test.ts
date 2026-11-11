import { describe, expect, it } from "vitest";
import { getDaysPast, getMonthEndLabel, getPlannerToday, parseDateKey } from "./date";

describe("getMonthEndLabel", () => {
  const currentMonth = parseDateKey("2026-07-01");

  it("describes the remaining days for a date in the displayed month", () => {
    expect(getMonthEndLabel(parseDateKey("2026-07-28"), currentMonth)).toBe("월말 D-3");
  });

  it("labels the final day of the displayed month", () => {
    expect(getMonthEndLabel(parseDateKey("2026-07-31"), currentMonth)).toBe("월말");
  });

  it("does not label an adjacent month date", () => {
    expect(getMonthEndLabel(parseDateKey("2026-06-30"), currentMonth)).toBeNull();
  });
});

describe("getDaysPast", () => {
  it("advances overdue counts at the planner's 03:00 boundary", () => {
    expect(getDaysPast("2026-11-09", getPlannerToday(new Date(2026, 10, 12, 2, 59)))).toBe(2);
    expect(getDaysPast("2026-11-09", getPlannerToday(new Date(2026, 10, 12, 3, 0)))).toBe(3);
    expect(getDaysPast("2026-11-13", "2026-11-12")).toBe(0);
  });
});
