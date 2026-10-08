import { describe, expect, it } from "vitest";
import { validateRestorableBackup } from "./backupRestore";

const full = {
  version: 13,
  exportedAt: "2026-10-08T10:00:00.000Z",
  categories: [{ id: "c1" }],
  projects: [],
  todos: [{ id: "t1" }],
  memos: [],
};

describe("backup restore guard", () => {
  it("previews a full current-version export", () => {
    expect(validateRestorableBackup(full).counts).toEqual({ todos: 1, categories: 1, projects: 0, memos: 0 });
  });
  it("rejects old versions, partial data, and malformed exports", () => {
    expect(() => validateRestorableBackup({ ...full, version: 12 })).toThrow();
    expect(() => validateRestorableBackup({ ...full, todos: undefined })).toThrow();
    expect(() => validateRestorableBackup({ ...full, exportedAt: undefined })).toThrow();
    expect(() => validateRestorableBackup([])).toThrow();
  });
});
