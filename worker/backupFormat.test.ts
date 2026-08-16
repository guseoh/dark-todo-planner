import { describe, expect, it } from "vitest";
import { BACKUP_VERSION, SUPPORTED_BACKUP_VERSIONS, normalizeBackupPayload, normalizeBackupV8Relations } from "./backupFormat";

describe("backup format v9", () => {
  it("keeps v7/v8 backups compatible while exposing newer collections", () => {
    const { data, warnings } = normalizeBackupPayload({ version: 7, projects: [{ id: "project-1", name: "기존 프로젝트" }], todos: [{ id: "todo-1", title: "기존 Todo", date: "2026-08-16" }], memos: [{ id: "memo-1", content: "기존 메모" }] });
    expect(BACKUP_VERSION).toBe(9);
    expect(SUPPORTED_BACKUP_VERSIONS).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(warnings).toEqual([]);
    expect(data.projectDecisions).toEqual([]);
    expect(data.memoTodoLinks).toEqual([]);
    expect(data.memoProjectLinks).toEqual([]);
    expect(data.dailyPlans).toEqual([]);
    expect(data.timeBlocks).toEqual([]);
    expect(data.plannerSettings).toEqual([]);
    expect(data.todoTrash).toEqual([]);
  });

  it("restores only valid project decisions and memo relations", () => {
    const { data } = normalizeBackupPayload({
      version: 8,
      projectDecisions: [
        { id: "decision-1", projectId: "project-1", title: "DB 선택", decision: "D1을 유지한다", rationale: "현재 규모에 충분하다", decidedAt: "2026-08-16", createdAt: "2026-08-16T01:00:00.000Z", updatedAt: "2026-08-16T01:00:00.000Z" },
        { id: "decision-orphan", projectId: "missing", title: "고아", decision: "제외", decidedAt: "2026-08-16" },
        { id: "decision-1", projectId: "project-1", title: "중복", decision: "제외", decidedAt: "2026-08-16" },
      ],
      memoTodoLinks: [{ memoId: "memo-1", todoId: "todo-1", createdAt: "2026-08-16T02:00:00.000Z" }, { memoId: "memo-1", todoId: "todo-1" }, { memoId: "memo-1", todoId: "missing" }],
      memoProjectLinks: [{ memoId: "memo-1", projectId: "project-1" }, { memoId: "missing", projectId: "project-1" }],
    });
    const normalized = normalizeBackupV8Relations(data, { projectIds: new Set(["project-1"]), todoIds: new Set(["todo-1"]), memoIds: new Set(["memo-1"]) }, "2026-08-16T03:00:00.000Z");
    expect(normalized.projectDecisions).toHaveLength(1);
    expect(normalized.projectDecisions[0]).toMatchObject({ id: "decision-1", projectId: "project-1" });
    expect(normalized.memoTodoLinks).toEqual([{ memoId: "memo-1", todoId: "todo-1", createdAt: "2026-08-16T02:00:00.000Z" }]);
    expect(normalized.memoProjectLinks).toEqual([{ memoId: "memo-1", projectId: "project-1", createdAt: "2026-08-16T03:00:00.000Z" }]);
    expect(normalized.skipped).toEqual({ projectDecisions: 2, memoTodoLinks: 2, memoProjectLinks: 1 });
  });

  it("still accepts the oldest Todo-array backup shape", () => {
    const { data, warnings } = normalizeBackupPayload([{ id: "todo-1", title: "legacy", date: "2026-08-16" }]);
    expect(data.todos).toHaveLength(1);
    expect(warnings).toEqual(["버전 없는 Todo 배열을 legacy 백업으로 처리했습니다."]);
  });
});
