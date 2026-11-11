import { describe, expect, it } from "vitest";
import { exceedsWipLimit } from "./projectWorkflow";

describe("exceedsWipLimit", () => {
  it("warns only above a configured positive limit", () => {
    expect(exceedsWipLimit(4, 3)).toBe(true);
    expect(exceedsWipLimit(3, 3)).toBe(false);
    expect(exceedsWipLimit(5)).toBe(false);
    expect(exceedsWipLimit(5, 0)).toBe(false);
  });
});
