import { describe, expect, it } from "vitest";
import { classifyPlannerErrors } from "./plannerLoadState";

describe("classifyPlannerErrors", () => {
  it("blocks false empty content when the first load fails", () => {
    expect(classifyPlannerErrors({
      loadedOnce: false,
      loadError: "초기 조회 실패",
      operationError: "",
    })).toEqual({
      initialLoadError: "초기 조회 실패",
      backgroundOrOperationError: "",
    });
  });

  it("keeps loaded content available when a refresh fails", () => {
    expect(classifyPlannerErrors({
      loadedOnce: true,
      loadError: "최신 조회 실패",
      operationError: "",
    })).toEqual({
      initialLoadError: "",
      backgroundOrOperationError: "최신 조회 실패",
    });
  });

  it("treats a form operation failure as non-blocking after a successful load", () => {
    expect(classifyPlannerErrors({
      loadedOnce: true,
      loadError: "",
      operationError: "저장 실패",
    })).toEqual({
      initialLoadError: "",
      backgroundOrOperationError: "저장 실패",
    });
  });
});
