import { describe, expect, it } from "vitest";
import type { Todo } from "../types/todo";
import { sortTodosByOrder } from "./todo";

const todo = (id: string, order: number | undefined, createdAt: string): Todo => ({
  id, userId: "u", title: id, date: "2026-11-16", priority: "MEDIUM", completed: false, archived: false,
  planningState: "SCHEDULED", workflowStatus: "TODO", order, createdAt, updatedAt: createdAt,
}) as Todo;

describe("sortTodosByOrder", () => {
  it("keeps the saved order, so a freshly added Todo stays in its category sequence", () => {
    const list = [todo("1-3", 2, "2026-11-16T07:50:26Z"), todo("1-1", 0, "2026-11-16T07:50:10Z"), todo("1-2", 1, "2026-11-16T07:50:21Z")];
    expect(sortTodosByOrder(list).map((item) => item.id)).toEqual(["1-1", "1-2", "1-3"]);
  });

  it("breaks ties like the server: newest first, then id", () => {
    const list = [todo("a", 0, "2026-11-16T07:00:00Z"), todo("b", 0, "2026-11-16T08:00:00Z"), todo("c", 0, "2026-11-16T08:00:00Z")];
    expect(sortTodosByOrder(list).map((item) => item.id)).toEqual(["b", "c", "a"]);
  });

  it("treats a missing order (queued offline Todo) as 0 and does not mutate the input", () => {
    const list = [todo("late", 3, "2026-11-16T09:00:00Z"), todo("queued", undefined, "2026-11-16T09:30:00Z")];
    expect(sortTodosByOrder(list).map((item) => item.id)).toEqual(["queued", "late"]);
    expect(list.map((item) => item.id)).toEqual(["late", "queued"]);
  });

  it("applies a reorder to the array itself, not only to the order values", () => {
    const list = [todo("x", 0, "2026-11-16T07:00:00Z"), todo("y", 1, "2026-11-16T07:01:00Z"), todo("z", 2, "2026-11-16T07:02:00Z")];
    const reordered = list.map((item) => ({ ...item, order: ({ z: 0, x: 1, y: 2 } as Record<string, number>)[item.id] }));
    expect(sortTodosByOrder(reordered).map((item) => item.id)).toEqual(["z", "x", "y"]);
  });
});
