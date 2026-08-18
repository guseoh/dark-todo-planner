import { describe, expect, it } from "vitest";
import { toTodoCompletionState } from "./routes/todoCompletion";

describe("todo completion state", () => {
  it("완료 상태는 DONE으로 고정한다", () => {
    expect(toTodoCompletionState(true)).toEqual({ completed: true, workflowStatus: "DONE" });
  });

  it("미완료 상태는 TODO로 고정한다", () => {
    expect(toTodoCompletionState(false)).toEqual({ completed: false, workflowStatus: "TODO" });
  });

  it("같은 최종 상태를 반복 적용해도 결과가 같다", () => {
    expect(toTodoCompletionState(true)).toEqual(toTodoCompletionState(true));
    expect(toTodoCompletionState(false)).toEqual(toTodoCompletionState(false));
  });
});
