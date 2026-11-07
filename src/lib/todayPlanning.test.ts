import { describe, expect, it } from "vitest";
import type { Todo } from "../types/todo";
import { isTodayPlanningCandidate, selectTodayCandidates } from "./todayPlanning";

const today = "2026-11-08";
const makeTodo = (id: string, patch: Partial<Todo> = {}): Todo => ({
  id, title: id, date: "2026-11-10", planningState: "SCHEDULED", workflowStatus: "TODO",
  priority: "MEDIUM", completed: false, archived: false, createdAt: today, updatedAt: today,
  ...patch,
});

describe("Today planning candidates", () => {
  it("excludes today, overdue, waiting, blocked, completed and archived items", () => {
    const list = [
      makeTodo("today", { date: today }), makeTodo("overdue", { date: "2026-11-07" }),
      makeTodo("waiting", { planningState: "WAITING" }),
      makeTodo("blocked", { workflowStatus: "BLOCKED" }),
      makeTodo("done", { completed: true }), makeTodo("workflow-done", { workflowStatus: "DONE" }),
      makeTodo("archived", { archived: true }), makeTodo("future"),
    ];
    expect(selectTodayCandidates(list, today).map((task) => task.id)).toEqual(["future"]);
    expect(isTodayPlanningCandidate(makeTodo("future"), today)).toBe(true);
  });

  it("includes both future and unscheduled project tasks without modifying their metadata", () => {
    const future = makeTodo("future", { projectId: "p1", milestoneId: "m1", dueDate: "2026-11-12" });
    const someday = makeTodo("someday", { planningState: "SOMEDAY", date: "9999-12-31", priority: "HIGH" });
    const inbox = makeTodo("inbox", { planningState: "INBOX", date: "9999-12-31" });
    const input = [future, someday, inbox];
    expect(selectTodayCandidates(input, today).map((t) => t.id)).toEqual(["future", "someday", "inbox"]);
    expect(future).toMatchObject({ date: "2026-11-10", dueDate: "2026-11-12", projectId: "p1", milestoneId: "m1" });
  });

  it("reserves capacity for unscheduled work and honors the limit", () => {
    const scheduled = Array.from({ length: 10 }, (_, i) => makeTodo("future" + i, { date: "2026-11-" + String(10 + i) }));
    const unscheduled = Array.from({ length: 3 }, (_, i) => makeTodo("maybe" + i, { planningState: "SOMEDAY" }));
    const result = selectTodayCandidates([...scheduled, ...unscheduled], today, 6);
    expect(result).toHaveLength(6);
    expect(result.filter((t) => t.planningState === "SOMEDAY")).toHaveLength(3);
    expect(selectTodayCandidates(scheduled, today, 0)).toEqual([]);
  });
});
