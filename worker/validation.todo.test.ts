import { describe, expect, it } from "vitest";
import { todoInputSchema } from "./validation";

const base = { title: "안전한 저장", date: "2026-10-08" };

describe("Todo reference links", () => {
  it("accepts HTTP links and clearing an existing link", () => {
    expect(todoInputSchema.safeParse({ ...base, referenceUrl: "https://github.com/guseoh", referenceLabel: "GitHub" }).success).toBe(true);
    expect(todoInputSchema.safeParse({ ...base, referenceUrl: null, referenceLabel: null }).success).toBe(true);
  });
  it("rejects unsafe links and excessive label lengths", () => {
    expect(todoInputSchema.safeParse({ ...base, referenceUrl: "javascript:alert(1)" }).success).toBe(false);
    expect(todoInputSchema.safeParse({ ...base, referenceUrl: "file:///tmp/private" }).success).toBe(false);
    expect(todoInputSchema.safeParse({ ...base, referenceLabel: "x".repeat(81) }).success).toBe(false);
  });
});
