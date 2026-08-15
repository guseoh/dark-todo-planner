import { describe, expect, it, vi } from "vitest";
import { deleteTodosByIds, normalizeBulkTodoIds } from "./todos";

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
