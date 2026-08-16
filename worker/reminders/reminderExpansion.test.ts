import { describe, expect, it } from "vitest";
import { selectIncompleteTodoReminderTargets, type ReminderTodo } from "./incompleteTodoReminder";

const todo = (id: string, overrides: Partial<ReminderTodo> = {}): ReminderTodo => ({
  id,
  title: id,
  date: "2026-08-16",
  completed: false,
  archived: false,
  repeat: "NONE",
  ...overrides,
});

describe("expanded Todo reminders", () => {
  it("can combine today, overdue due dates, and due-soon due dates without duplicates", () => {
    const targets = selectIncompleteTodoReminderTargets(
      [
        todo("today", { dueDate: "2026-08-16" }),
        todo("overdue", { date: "2026-08-20", dueDate: "2026-08-15" }),
        todo("soon", { date: "2026-08-20", dueDate: "2026-08-18" }),
        todo("later", { date: "2026-08-20", dueDate: "2026-08-25" }),
      ],
      "2026-08-16",
      { reminderTodayEnabled: true, reminderOverdueEnabled: true, reminderDueSoonEnabled: true, reminderDueSoonDays: 3 },
    );

    expect(targets.map((item) => item.id)).toEqual(["today", "overdue", "soon"]);
  });

  it("keeps the original today-only behavior when expanded reminders are disabled", () => {
    const targets = selectIncompleteTodoReminderTargets(
      [todo("overdue", { date: "2026-08-15", dueDate: "2026-08-15" }), todo("today")],
      "2026-08-16",
    );
    expect(targets.map((item) => item.id)).toEqual(["today"]);
  });
});
