import { describe, expect, it } from "vitest";
import { getSnoozedReminderAt } from "./todoReminder";

describe("Todo reminder snooze", () => {
  const now = new Date("2026-08-17T06:30:00.000Z"); // 15:30 KST

  it("supports minute/hour presets", () => {
    expect(getSnoozedReminderAt(now, "10m").toISOString()).toBe("2026-08-17T06:40:00.000Z");
    expect(getSnoozedReminderAt(now, "30m").toISOString()).toBe("2026-08-17T07:00:00.000Z");
    expect(getSnoozedReminderAt(now, "1h").toISOString()).toBe("2026-08-17T07:30:00.000Z");
  });

  it("uses tomorrow 09:00 Asia/Seoul", () => {
    expect(getSnoozedReminderAt(now, "tomorrow").toISOString()).toBe("2026-08-18T00:00:00.000Z");
  });
});
