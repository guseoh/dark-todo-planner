import { describe, expect, it, vi } from "vitest";
import type { Todo } from "../types/todo";
import {
  buildDefaultOverdueSelection,
  dedupeTodosById,
  getDuplicateTodoGroups,
  getOverdueIncompleteTodos,
  importSelectedOverdueTodos,
} from "./todoRecovery";

const todo = (id: string, overrides: Partial<Todo> = {}): Todo => ({
  id,
  title: `Todo ${id}`,
  date: "2026-07-20",
  priority: "MEDIUM",
  completed: false,
  createdAt: `2026-07-20T00:00:0${id.length}Z`,
  updatedAt: "2026-07-20T00:00:00Z",
  repeat: "NONE",
  tags: [],
  archived: false,
  ...overrides,
  planningState: overrides.planningState ?? "SCHEDULED",
  workflowStatus: overrides.workflowStatus ?? (overrides.completed ? "DONE" : "TODO"),
});

describe("overdue Todo selection", () => {
  it("includes only active, incomplete, non-repeating scheduled Todos before planner today", () => {
    const result = getOverdueIncompleteTodos(
      [
        todo("eligible"),
        todo("today", { date: "2026-07-28" }),
        todo("future", { date: "2026-07-29" }),
        todo("completed", { completed: true }),
        todo("archived", { archived: true }),
        todo("repeat", { repeat: "DAILY" }),
        todo("inbox", { planningState: "INBOX" }),
      ],
      "2026-07-28",
    );

    expect(result.map(({ id }) => id)).toEqual(["eligible"]);
  });

  it("selects only the newest Todo by default within the same duplicate key", () => {
    const older = todo("older", { title: " 같은 제목 ", date: "2026-07-20" });
    const newer = todo("newer", { title: "같은 제목", date: "2026-07-22" });
    const unique = todo("unique", { title: "다른 제목" });

    expect([...buildDefaultOverdueSelection([older, newer, unique])].sort()).toEqual(["newer", "unique"]);
  });
});

describe("duplicate Todo candidates", () => {
  it("groups normalized titles only when category and repeat key match", () => {
    const groups = getDuplicateTodoGroups([
      todo("first", { title: "  READ BOOK ", categoryId: "reading" }),
      todo("second", { title: "read book", categoryId: "reading", date: "2026-07-21" }),
      todo("other-category", { title: "read book", categoryId: "work" }),
      todo("repeating", { title: "read book", categoryId: "reading", repeat: "WEEKLY" }),
      todo("archived", { title: "read book", categoryId: "reading", archived: true }),
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0].todos.map(({ id }) => id)).toEqual(["second", "first"]);
  });
});

describe("dedupeTodosById", () => {
  it("keeps the first Todo for duplicated IDs", () => {
    const first = todo("same", { title: "first" });
    const second = todo("same", { title: "second" });
    expect(dedupeTodosById([first, second, todo("other")]).map(({ title }) => title)).toEqual(["first", "Todo other"]);
  });
});

describe("overdue import", () => {
  it("skips duplicates already on today and imports the rest", async () => {
    const copyTodo = vi.fn(async (_item: Todo) => true);
    const moveTodo = vi.fn(async (_item: Todo) => true);
    const overdue = [todo("a", { title: "same" }), todo("b", { title: "new" })];
    const result = await importSelectedOverdueTodos({
      overdueTodos: overdue,
      selectedIds: new Set(["a", "b"]),
      todayTodos: [todo("today", { title: "same", date: "2026-07-28" })],
      mode: "copy",
      copyTodo,
      moveTodo,
    });

    expect(result).toEqual({ total: 2, success: 1, skipped: 1, failed: 0, mode: "copy" });
    expect(copyTodo).toHaveBeenCalledTimes(1);
    expect(copyTodo.mock.calls[0]?.[0]?.id).toBe("b");
    expect(moveTodo).not.toHaveBeenCalled();
  });

  it("counts failed imports without stopping later Todo processing", async () => {
    const copyTodo = vi.fn(async (item: Todo) => item.id !== "fail");
    const result = await importSelectedOverdueTodos({
      overdueTodos: [todo("fail"), todo("ok")],
      selectedIds: new Set(["fail", "ok"]),
      todayTodos: [],
      mode: "copy",
      copyTodo,
      moveTodo: vi.fn(async (_item: Todo) => true),
    });

    expect(result).toEqual({ total: 2, success: 1, skipped: 0, failed: 1, mode: "copy" });
    expect(copyTodo).toHaveBeenCalledTimes(2);
  });

  it("moves selected Todo when move mode is chosen", async () => {
    const moveTodo = vi.fn(async (_item: Todo) => true);
    const result = await importSelectedOverdueTodos({
      overdueTodos: [todo("move")],
      selectedIds: new Set(["move"]),
      todayTodos: [],
      mode: "move",
      copyTodo: vi.fn(async (_item: Todo) => true),
      moveTodo,
    });

    expect(result).toEqual({ total: 1, success: 1, skipped: 0, failed: 0, mode: "move" });
    expect(moveTodo).toHaveBeenCalledTimes(1);
  });
});
