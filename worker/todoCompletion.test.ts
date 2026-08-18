import { describe, expect, it } from "vitest";

const completionState = (completed: boolean) => ({
  completed,
  workflowStatus: completed ? "DONE" as const : "TODO" as const,
});

describe("todo completion state", () => {
  it("완료 상태는 DONE으로 고정한다", () => {
    expect(completionState(true)).toEqual({ completed: true, workflowStatus: "DONE" });
  });

  it("미완료 상태는 TODO로 고정한다", () => {
    expect(completionState(false)).toEqual({ completed: false, workflowStatus: "TODO" });
  });

  it("같은 최종 상태를 반복 적용해도 결과가 같다", () => {
    expect(completionState(true)).toEqual(completionState(true));
    expect(completionState(false)).toEqual(completionState(false));
  });
});
