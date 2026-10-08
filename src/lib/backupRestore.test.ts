import { describe, expect, it } from "vitest";
import { FULL_RESTORE_COLLECTIONS } from "./backupRestore";
import { validateRestorableBackup } from "./backupRestore";

const full = {
  version: 13,
  exportedAt: "2026-10-08T10:00:00.000Z",
  ...Object.fromEntries(FULL_RESTORE_COLLECTIONS.map((key) => [key, []])),
  scratchpad: { content: "", updatedAt: null },
};

describe("backup restore UI guard", () => {
  it("previews a complete current-version export", () => {
    expect(validateRestorableBackup({ ...full, todos: [{ id: "t1", title: "Todo", date: "2026-10-08" }] })).toMatchObject({
      version: 13, collectionCount: 25, counts: { todos: 1, categories: 0, projects: 0, memos: 0 },
    });
  });
  it("rejects old versions, partial data, and malformed exports", () => {
    expect(() => validateRestorableBackup({ ...full, version: 12 })).toThrow();
    expect(() => validateRestorableBackup({ ...full, routineRuns: undefined })).toThrow();
    expect(() => validateRestorableBackup({ ...full, exportedAt: undefined })).toThrow();
    expect(() => validateRestorableBackup([])).toThrow();
  });
});
