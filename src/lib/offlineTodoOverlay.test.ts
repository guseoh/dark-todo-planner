import { describe, expect, it } from "vitest";
import type { Todo } from "../types/todo";
import type { QueuedTodoMutation } from "./offlineTodoQueue";
import { replayQueuedTodoMutations } from "./offlineTodoOverlay";

const base: Todo = {
  id: "a", title: "서버 버전", date: "2026-10-08", planningState: "SCHEDULED", workflowStatus: "TODO",
  priority: "MEDIUM", completed: false, archived: false,
  createdAt: "2026-10-08T09:00:00Z", updatedAt: "2026-10-08T09:00:00Z",
};
const queued = (kind: QueuedTodoMutation["kind"], path: string, body?: unknown, id = 1): QueuedTodoMutation => ({
  id, kind, method: kind === "TRASH" || kind === "BULK_TRASH" || kind === "BULK_UPDATE" ? "POST" : "PUT",
  path, body, createdAt: "2026-10-08T10:00:00Z", attempts: 0, state: "PENDING",
});

describe("offline snapshot reconciliation", () => {
  it("shows an offline created Todo after a server refresh and preserves its client UUID", () => {
    const result = replayQueuedTodoMutations([], [queued("CREATE", "/api/offline/todos/client-1", { title: "임시 작업", date: base.date })]);
    expect(result).toMatchObject([{ id: "client-1", title: "임시 작업", completed: false, archived: false }]);
  });

  it("keeps pending and FAILED edits over stale server rows without mutating source", () => {
    const change = { ...base, title: "수정 후", categoryId: "changed" };
    const result = replayQueuedTodoMutations([base], [queued("UPDATE", "/api/todos/a", change)]);
    expect(result[0]).toMatchObject({ id: "a", title: "수정 후", categoryId: "changed" });
    expect(base.title).toBe("서버 버전");
    expect(replayQueuedTodoMutations([base], [{ ...queued("UPDATE", "/api/todos/a", change), state: "FAILED" }])[0].title).toBe("수정 후");
  });

  it("replays completion, bulk update and bulk trash in insertion order", () => {
    const result = replayQueuedTodoMutations([base, { ...base, id: "b" }], [
      queued("UPDATE", "/api/todos/a/completion", { completed: true }, 3),
      queued("BULK_UPDATE", "/api/todos/bulk-update", { ids: ["b"], action: { type: "PRIORITY", value: "HIGH" } }, 4),
      queued("BULK_TRASH", "/api/todos/bulk-trash", { ids: ["a"] }, 5),
    ]);
    expect(result).toMatchObject([{ id: "b", priority: "HIGH" }]);
  });

  it("replays scheduling and project changes in order, including a created-then-trashed Todo", () => {
    const original = { ...base, projectId: "p-old", milestoneId: "m", parentTodoId: "parent" };
    const result = replayQueuedTodoMutations([original], [
      queued("CREATE", "/api/offline/todos/client-1", { title: "삭제할 임시 Todo", date: base.date }, 1),
      queued("BULK_UPDATE", "/api/todos/bulk-update", { ids: ["a"], action: { type: "PROJECT", value: null } }, 2),
      queued("BULK_UPDATE", "/api/todos/bulk-update", { ids: ["a"], action: { type: "DATE", value: "2026-10-11" } }, 3),
      queued("TRASH", "/api/todos/client-1/trash", undefined, 4),
    ]);
    expect(result).toMatchObject([{ id: "a", projectId: undefined, milestoneId: undefined, date: "2026-10-11" }]);
  });

  it("does not duplicate an existing replayed UUID or allow an invalid operation to delete records", () => {
    expect(replayQueuedTodoMutations([base], [
      queued("CREATE", "/api/offline/todos/a", { title: "다른 제목", date: base.date }),
      queued("TRASH", "/api/todos/bad", undefined, 2),
    ])).toEqual([base]);
  });
});
