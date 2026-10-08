import { describe, expect, it } from "vitest";
import { resolveTodoScheduledDate } from "./todoScheduledDate";

describe("resolveTodoScheduledDate", () => {
  it("uses today when scheduling an Inbox item with no date", () => {
    expect(resolveTodoScheduledDate("", "9999-12-31", "2026-10-08")).toBe("2026-10-08");
  });
  it("preserves the old scheduled date when it is real", () => {
    expect(resolveTodoScheduledDate("", "2026-10-11", "2026-10-08")).toBe("2026-10-11");
  });
  it("uses a user-selected date", () => {
    expect(resolveTodoScheduledDate("2026-10-15", "9999-12-31", "2026-10-08")).toBe("2026-10-15");
  });
});
