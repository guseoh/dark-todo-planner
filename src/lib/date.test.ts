import { describe, expect, it } from "vitest";
import { getMonthEndLabel, parseDateKey } from "./date";

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
