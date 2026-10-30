import { describe, expect, it } from "vitest";
import { isScratchpadRecoveryNeeded, parseScratchpadDraft } from "./scratchpadDraft";

describe("scratchpad local recovery", () => {
  it("accepts a valid recovery draft", () => {
    const draft = parseScratchpadDraft(JSON.stringify({ content: "첫 줄\n둘째 줄", savedAt: 1761800000000 }));
    expect(draft).toEqual({ content: "첫 줄\n둘째 줄", savedAt: 1761800000000 });
    expect(isScratchpadRecoveryNeeded(draft, "서버 내용")).toBe(true);
    expect(isScratchpadRecoveryNeeded(draft, "첫 줄\n둘째 줄")).toBe(false);
  });

  it("rejects corrupt or incomplete data instead of overwriting server content", () => {
    for (const raw of [null, "", "{", "[]", "{}", '{"content":1,"savedAt":2}', '{"content":"hi","savedAt":0}', '{"content":"hi","savedAt":"yesterday"}']) {
      expect(parseScratchpadDraft(raw)).toBeNull();
    }
    expect(isScratchpadRecoveryNeeded(null, "saved")).toBe(false);
  });

  it("rejects unbounded drafts", () => {
    expect(parseScratchpadDraft(JSON.stringify({ content: "x".repeat(2_000_001), savedAt: 123 }))).toBeNull();
  });
});
