import { describe, expect, it } from "vitest";
import { formatCompletionRate } from "./todo";

describe("formatCompletionRate", () => {
  it("shows no calculated rate when there are no Todos", () => {
    expect(formatCompletionRate(0, 0)).toBe("—");
  });

  it("keeps zero percent when Todos exist but none are completed", () => {
    expect(formatCompletionRate(3, 0)).toBe("0%");
  });
});
