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
});

describe("overdue Todo selection", () => {
  it("includes only active, incomplete, non-repeating Todos before planner today", () => {
    const result = getOverdueIncompleteTodos(
      [
        todo("eligible"),
        todo("today", { date: "2026-07-28" }),
        todo("future", { date: "2026-07-29" }),
        todo("completed", { completed: true }),
        todo("archived", { archived: true }),
        todo("repeat", { repeat: "DAILY" }),
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

describe("Todo page recovery", () => {
  it("keeps the first item when paginated responses contain the same id", () => {
    const first = todo("same", { title: "첫 페이지" });
    const duplicate = todo("same", { title: "다음 페이지" });

    expect(dedupeTodosById([first, todo("other"), duplicate])).toEqual([first, todo("other")]);
  });

  it("reports copy successes, existing-today skips, and failures separately", async () => {
    const copyTodo = vi.fn(async (item: Todo) => item.id !== "fails");
    const overdue = [
      todo("copied", { title: "복사" }),
      todo("skipped", { title: "이미 오늘 있음" }),
      todo("fails", { title: "실패" }),
    ];

    const result = await importSelectedOverdueTodos({
      overdueTodos: overdue,
      selectedIds: new Set(overdue.map(({ id }) => id)),
      todayTodos: [todo("today", { title: "이미 오늘 있음", date: "2026-07-28" })],
      mode: "copy",
      copyTodo,
      moveTodo: vi.fn(),
    });

    expect(result).toEqual({ total: 3, success: 1, skipped: 1, failed: 1, mode: "copy" });
    expect(copyTodo).toHaveBeenCalledTimes(2);
  });

  it("processes the newest duplicate first and skips older duplicates after success", async () => {
    const older = todo("older", {
      title: "같은 일정",
      date: "2026-07-20",
      createdAt: "2026-07-20T09:00:00Z",
    });
    const newer = todo("newer", {
      title: " 같은 일정 ",
      date: "2026-07-22",
      createdAt: "2026-07-22T09:00:00Z",
    });
    const moveTodo = vi.fn(async () => true);

    const result = await importSelectedOverdueTodos({
      overdueTodos: [older, newer],
      selectedIds: new Set([older.id, newer.id]),
      todayTodos: [],
      mode: "move",
      copyTodo: vi.fn(),
      moveTodo,
    });

    expect(result).toEqual({ total: 2, success: 1, skipped: 1, failed: 0, mode: "move" });
    expect(moveTodo).toHaveBeenCalledTimes(1);
    expect(moveTodo.mock.calls[0][0].id).toBe("newer");
  });

  it("tries an older duplicate when the newest duplicate fails", async () => {
    const older = todo("older", {
      title: "같은 일정",
      date: "2026-07-20",
      createdAt: "2026-07-20T09:00:00Z",
    });
    const newer = todo("newer", {
      title: "같은 일정",
      date: "2026-07-22",
      createdAt: "2026-07-22T09:00:00Z",
    });
    const moveTodo = vi.fn(async (item: Todo) => item.id === "older");

    const result = await importSelectedOverdueTodos({
      overdueTodos: [older, newer],
      selectedIds: new Set([older.id, newer.id]),
      todayTodos: [],
      mode: "move",
      copyTodo: vi.fn(),
      moveTodo,
    });

    expect(result).toEqual({ total: 2, success: 1, skipped: 0, failed: 1, mode: "move" });
    expect(moveTodo.mock.calls.map(([item]) => item.id)).toEqual(["newer", "older"]);
  });

  it("continues moving selected Todos when one operation throws", async () => {
    const moveTodo = vi.fn(async (item: Todo) => {
      if (item.id === "throws") throw new Error("network");
      return true;
    });
    const overdue = [todo("moved"), todo("throws"), todo("also-moved")];

    const result = await importSelectedOverdueTodos({
      overdueTodos: overdue,
      selectedIds: new Set(overdue.map(({ id }) => id)),
      todayTodos: [],
      mode: "move",
      copyTodo: vi.fn(),
      moveTodo,
    });

    expect(result).toEqual({ total: 3, success: 2, skipped: 0, failed: 1, mode: "move" });
    expect(moveTodo).toHaveBeenCalledTimes(3);
  });
});
