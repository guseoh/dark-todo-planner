import { describe, expect, it } from "vitest";
import { ApiError } from "./api/client";
import { isRetryableTodoMutationError, summarizeTodoMutations, type QueuedTodoMutation } from "./offlineTodoQueue";

const mutation = (overrides: Partial<QueuedTodoMutation> = {}): QueuedTodoMutation => ({
  id: 1,
  kind: "UPDATE",
  method: "PUT",
  path: "/api/todos/todo-1",
  body: { title: "Todo" },
  createdAt: "2026-08-17T00:00:00.000Z",
  attempts: 0,
  state: "PENDING",
  ...overrides,
});

describe("offline Todo queue helpers", () => {
  it("summarizes pending and failed mutations without discarding failure details", () => {
    expect(summarizeTodoMutations([
      mutation(),
      mutation({ id: 2, state: "FAILED", lastError: "프로젝트를 찾을 수 없습니다." }),
    ])).toEqual({
      pending: 1,
      failed: 1,
      total: 2,
      firstError: "프로젝트를 찾을 수 없습니다.",
    });
  });

  it("retries network and server failures but not permanent client validation failures", () => {
    expect(isRetryableTodoMutationError(new TypeError("Failed to fetch"))).toBe(true);
    expect(isRetryableTodoMutationError(new ApiError("서버 오류", 503))).toBe(true);
    expect(isRetryableTodoMutationError(new ApiError("입력 오류", 400))).toBe(false);
  });
});
