import { describe, expect, it } from "vitest";
import type { Todo } from "../types/todo";
import { groupSelectionState, invertSelection, selectionGroups, toggleGroupSelection } from "./selection";

const todo = (id: string, categoryId?: string) => ({ id, categoryId }) as Todo;

describe("group selection", () => {
  const study = ["s1", "s2"];
  const dev = ["d1", "d2", "d3"];

  it("reports none / some / all for a group", () => {
    expect(groupSelectionState(dev, new Set())).toBe("none");
    expect(groupSelectionState(dev, new Set(["d1"]))).toBe("some");
    expect(groupSelectionState(dev, new Set(dev))).toBe("all");
    expect(groupSelectionState([], new Set(["x"]))).toBe("none");
  });

  it("deselects one fully selected group without touching the others (the 'all except Devpedia' case)", () => {
    const everything = new Set([...study, ...dev]);
    const next = toggleGroupSelection(everything, dev);
    expect([...next].sort()).toEqual(study);
    expect([...everything].length).toBe(5);
  });

  it("selects a partially selected group in full", () => {
    expect([...toggleGroupSelection(new Set(["d1", "s1"]), dev)].sort()).toEqual(["d1", "d2", "d3", "s1"]);
  });

  it("inverts only within the shown Todos", () => {
    expect([...invertSelection([...study, ...dev], new Set(["s1", "d1"]))].sort()).toEqual(["d2", "d3", "s2"]);
  });

  it("groups shown Todos by category with uncategorized last and counts selections", () => {
    const groups = selectionGroups([todo("a"), todo("b", "c1"), todo("c", "c1"), todo("d", "c2")], new Set(["b"]));
    expect(groups.map((group) => [group.key, group.ids.length, group.selected])).toEqual([["c1", 2, 1], ["c2", 1, 0], ["uncategorized", 1, 0]]);
  });
});
