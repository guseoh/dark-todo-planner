import { describe, expect, it } from "vitest";
import { BACKUP_VERSION } from "./backupFormat";
import { FULL_RESTORE_COLLECTIONS, validateFullRestoreBackup } from "./backupRestoreValidation";

const complete = () => ({
  version: BACKUP_VERSION,
  exportedAt: "2026-10-08T11:00:00.000Z",
  ...Object.fromEntries(FULL_RESTORE_COLLECTIONS.map((key) => [key, []])),
  scratchpad: { content: "", updatedAt: null },
});

describe("destructive JSON import preflight", () => {
  it("accepts a complete empty export", () => {
    expect(validateFullRestoreBackup(complete())).toMatchObject({ version: 13 });
    expect(FULL_RESTORE_COLLECTIONS.length).toBe(25);
  });
  it("rejects missing fields, malformed arrays, older versions and missing scratchpad", () => {
    expect(() => validateFullRestoreBackup({ ...complete(), version: 12 })).toThrow();
    expect(() => validateFullRestoreBackup({ ...complete(), goals: undefined })).toThrow(/goals/);
    expect(() => validateFullRestoreBackup({ ...complete(), routineRuns: {} })).toThrow(/routineRuns/);
    expect(() => validateFullRestoreBackup({ ...complete(), scratchpad: null })).toThrow(/낙서장/);
    expect(() => validateFullRestoreBackup({ ...complete(), todos: [null] })).toThrow(/todos/);
  });
  it("rejects malformed or duplicate records instead of silently skipping", () => {
    const todo = { id: "t1", title: "일정", date: "2026-10-08" };
    expect(() => validateFullRestoreBackup({ ...complete(), todos: [{ id: "t1", date: "2026-10-08" }] })).toThrow(/title/);
    expect(() => validateFullRestoreBackup({ ...complete(), todos: [todo, todo] })).toThrow(/중복/);
    expect(() => validateFullRestoreBackup({ ...complete(), memos: [{ id: "m", content: "" }] })).toThrow(/content/);
  });
  it("rejects broken relations before any D1 write", () => {
    expect(() => validateFullRestoreBackup({ ...complete(), memoTodoLinks: [{ memoId: "orphan", todoId: "missing" }] })).toThrow(/memoId/);
    expect(() => validateFullRestoreBackup({ ...complete(), todos: [{ id: "t1", title: "Todo", date: "2026-10-08", projectId: "missing" }] })).toThrow(/projectId/);
    expect(() => validateFullRestoreBackup({ ...complete(), taskTemplates: [{ id: "template", name: "a" }] })).toThrow(/템플릿/);
  });
  it("rejects unsupported data that a full JSON restore would discard", () => {
    expect(() => validateFullRestoreBackup({ ...complete(), learningItems: [{ id: "li" }] })).toThrow(/learningItems/);
    expect(() => validateFullRestoreBackup({ ...complete(), todoReminders: [{ id: "r" }] })).toThrow(/todoReminders/);
  });
  it("accepts properly linked categories, projects, todos, memos and routines", () => {
    const payload = {
      ...complete(),
      categories: [{ id: "c", name: "work" }],
      projects: [{ id: "p", name: "app" }],
      todos: [{ id: "t", title: "Todo", date: "2026-10-08", categoryId: "c", projectId: "p" }],
      memos: [{ id: "m", content: "note" }],
      memoTodoLinks: [{ memoId: "m", todoId: "t" }],
      routineTemplates: [{ id: "r", name: "Morning" }],
      routineTemplateItems: [{ id: "item", routineId: "r", title: "Drink water" }],
    };
    expect(validateFullRestoreBackup(payload)).toBe(payload);
  });
});
