import { describe, expect, it } from "vitest";
import { duplicateTodoInput } from "./duplicateTodo";
import type { Todo } from "../types/todo";
describe("duplicate task", () => {
  it("copies content and grouping, but not completion, deadlines, hierarchy, external links or old schedule", () => {
    const source: Todo = { id: "old", title: "task", memo: "notes", projectId: "p", categoryId: "c", priority: "HIGH", date: "2026-01-01", dueDate: "2026-01-03", parentTodoId: "parent", milestoneId: "m", referenceUrl: "https://github.com/a/b/issues/1", completed: true, archived: true, workflowStatus: "DONE", planningState: "SCHEDULED", createdAt: "", updatedAt: "" };
    expect(duplicateTodoInput(source, "2026-11-24")).toEqual({ title: "task", memo: "notes", projectId: "p", categoryId: "c", priority: "HIGH", date: "2026-11-24", planningState: "SCHEDULED", workflowStatus: "TODO" });
  });
});
