import { describe, expect, it } from "vitest";
import { filterTodosBySavedView } from "./planning";
import type { Todo } from "../types/todo";

const todo = (overrides: Partial<Todo>): Todo => ({
  id: "todo-1",
  title: "테스트 Todo",
  date: "2026-08-16",
  planningState: "SCHEDULED",
  workflowStatus: "TODO",
  priority: "MEDIUM",
  completed: false,
  repeat: "NONE",
  tags: [],
  archived: false,
  createdAt: "2026-08-16T00:00:00.000Z",
  updatedAt: "2026-08-16T00:00:00.000Z",
  ...overrides,
});

describe("filterTodosBySavedView", () => {
  const todos = [
    todo({ id: "overdue", dueDate: "2026-08-15", priority: "HIGH" }),
    todo({ id: "soon", dueDate: "2026-08-18", projectId: "project-1" }),
    todo({ id: "waiting", planningState: "WAITING" }),
    todo({ id: "someday", planningState: "SOMEDAY", projectId: undefined }),
    todo({ id: "done", dueDate: "2026-08-14", completed: true, workflowStatus: "DONE" }),
    todo({ id: "archived", archived: true, priority: "HIGH" }),
  ];

  it("finds only active overdue todos", () => {
    expect(filterTodosBySavedView(todos, { dueMode: "OVERDUE" }, "2026-08-16").map((item) => item.id)).toEqual(["overdue"]);
  });

  it("finds todos due within three days", () => {
    expect(filterTodosBySavedView(todos, { dueMode: "DUE_SOON" }, "2026-08-16").map((item) => item.id)).toEqual(["soon"]);
  });

  it("combines planning and project filters", () => {
    expect(filterTodosBySavedView(todos, { planningState: "SOMEDAY", projectId: "NO_PROJECT" }, "2026-08-16").map((item) => item.id)).toEqual(["someday"]);
  });
});
