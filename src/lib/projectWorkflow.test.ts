import { describe, expect, it } from "vitest";
import { exceedsWipLimit, toggleDoneColumnCollapsed } from "./projectWorkflow";

describe("exceedsWipLimit", () => {
  it("warns only above a configured positive limit", () => {
    expect(exceedsWipLimit(4, 3)).toBe(true);
    expect(exceedsWipLimit(3, 3)).toBe(false);
    expect(exceedsWipLimit(5)).toBe(false);
    expect(exceedsWipLimit(5, 0)).toBe(false);
  });
});

describe("toggleDoneColumnCollapsed", () => {
  it("collapses an initially expanded column on the first click", () => {
    expect(toggleDoneColumnCollapsed(undefined)).toBe(true);
    expect(toggleDoneColumnCollapsed(false)).toBe(true);
  });
  it("expands a previously collapsed column", () => {
    expect(toggleDoneColumnCollapsed(true)).toBe(false);
  });
});
