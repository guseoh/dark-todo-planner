import { describe, expect, it } from "vitest";
import { makeTodoTemplate, readTodoTemplates } from "./todoTemplates";
describe("Todo templates", () => {
  it("does not retain deadlines, schedule, identity or external link", () => {
    expect(makeTodoTemplate("t", { title: " Study ", date: "2026-11-24", dueDate: "2026-12-01", referenceUrl: "https://example.com", planningState: "WAITING", workflowStatus: "DONE", priority: "HIGH" })).toEqual({ id: "t", title: "Study", memo: "", priority: "HIGH", projectId: undefined, categoryId: undefined });
  });
  it("ignores malformed local records", () => {
    expect(readTodoTemplates({ getItem: () => "bad json" })).toEqual([]);
    expect(readTodoTemplates({ getItem: () => '[{"id":"a","title":"x","memo":"","priority":"BAD"}]' })).toEqual([]);
  });
});
