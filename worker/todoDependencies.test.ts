import { describe, expect, it } from "vitest";
import { normalizeDependencyIds } from "./todoDependencies";

describe("normalizeDependencyIds", () => {
  it("trims, deduplicates, and removes invalid values", () => {
    expect(normalizeDependencyIds([" todo-a ", "todo-a", "todo-b", "", null, 3])).toEqual(["todo-a", "todo-b"]);
  });

  it("limits one Todo to twenty blockers", () => {
    const ids = Array.from({ length: 25 }, (_, index) => `todo-${index}`);
    expect(normalizeDependencyIds(ids)).toHaveLength(20);
    expect(normalizeDependencyIds(ids).at(-1)).toBe("todo-19");
  });
});
