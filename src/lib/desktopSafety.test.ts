import { describe, expect, it } from "vitest";
import { beginMaintenance, markDraftRecovery, registerRecoveryDraft, startNativeWrite } from "./desktopSafety";
describe("desktop maintenance", () => {
  it("blocks competing maintenance and writes", () => {
    const done = startNativeWrite();
    expect(() => beginMaintenance()).toThrow("저장 중");
    done();
    const end = beginMaintenance();
    try { expect(() => startNativeWrite()).toThrow("준비 중"); expect(() => beginMaintenance()).toThrow("진행 중"); } finally { end(); }
    startNativeWrite()();
  });
  it("blocks unsaved recovery drafts", () => {
    const remove = registerRecoveryDraft(() => false);
    try { expect(() => beginMaintenance()).toThrow("초안"); } finally { remove(); }
    markDraftRecovery("memo-test", false);
    try { expect(() => beginMaintenance()).toThrow("초안"); } finally { markDraftRecovery("memo-test", true); }
    beginMaintenance()();
  });
});
