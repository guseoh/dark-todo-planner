import { describe, expect, it, vi } from "vitest";
import { deleteTodosByIds, normalizeBulkTodoIds, hasTodoHierarchy } from "./todos";

describe("bulk Todo delete", () => {
  it("normalizes IDs by trimming, removing invalid values, and deduplicating", () => {
    expect(normalizeBulkTodoIds([" a ", "b", "a", "", 42, null])).toEqual(["a", "b"]);
    expect(normalizeBulkTodoIds("a")).toEqual([]);
  });

  it("scopes every delete statement to the user and chunks large selections", async () => {
    const prepared: Array<{ sql: string; bindings: unknown[] }> = [];
    const batch = vi.fn(async (statements: D1PreparedStatement[]) => statements);
    const db = {
      prepare(sql: string) {
        return {
          bind(...bindings: unknown[]) {
            const statement = { sql, bindings };
            prepared.push(statement);
            return statement as unknown as D1PreparedStatement;
          },
        };
      },
      batch,
    } as unknown as D1Database;

    const ids = Array.from({ length: 81 }, (_, index) => `todo-${index + 1}`);
    await deleteTodosByIds(db, "single-user", ids);

    expect(prepared).toHaveLength(2);
    expect(prepared[0].sql).toContain("DELETE FROM todos WHERE user_id = ? AND id IN");
    expect(prepared[0].bindings[0]).toBe("single-user");
    expect(prepared[0].bindings).toHaveLength(81);
    expect(prepared[1].bindings).toEqual(["single-user", "todo-81"]);
    expect(batch).toHaveBeenCalledTimes(1);
  });
});

describe("project movement hierarchy guard", () => {
  it("checks both directions, scopes to user and bounds SQL parameters", async () => {
    const calls: { sql: string; params: unknown[] }[] = [];
    const db = { prepare(sql: string) { return { bind(...params: unknown[]) { calls.push({ sql, params }); return { first: async () => null }; } }; } } as unknown as D1Database;
    expect(await hasTodoHierarchy(db, "user", Array.from({length: 81}, (_, i) => String(i)))).toBe(false);
    expect(calls).toHaveLength(4);
    expect(calls.every(call => call.params[0] === "user" && call.params.length <= 81)).toBe(true);
    expect(calls[0].sql).toContain("parent_todo_id IS NOT NULL");
    expect(calls[1].sql).toContain("parent_todo_id IN");
  });
  it("blocks a parent with children", async () => {
    const db = { prepare(sql: string) { return { bind() { return { first: async () => sql.includes("parent_todo_id IN") ? { id: "child" } : null }; } }; } } as unknown as D1Database;
    expect(await hasTodoHierarchy(db, "user", ["parent"])).toBe(true);
  });
});
