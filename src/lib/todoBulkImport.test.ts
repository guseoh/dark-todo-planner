import { describe, expect, it } from "vitest";
import type { Todo } from "../types/todo";
import { prepareOverdueBulkImport } from "./todoBulkImport";

const todo = (id: string, title: string, date: string, createdAt = "2026-08-20T00:00:00.000Z"): Todo => ({
  id,
  title,
  date,
  planningState: "SCHEDULED",
  workflowStatus: "TODO",
  priority: "MEDIUM",
  completed: false,
  createdAt,
  updatedAt: createdAt,
  repeat: "NONE",
  tags: [],
  archived: false,
});

describe("prepareOverdueBulkImport", () => {
  it("오늘 이미 존재하는 중복 Todo는 건너뛴다", () => {
    const overdue = [todo("old", "리뷰", "2026-08-22")];
    const today = [todo("today", " 리뷰 ", "2026-08-24")];

    expect(prepareOverdueBulkImport(overdue, new Set(["old"]), today)).toEqual({
      ids: [],
      total: 1,
      skipped: 1,
    });
  });

  it("선택 항목끼리 중복이면 최신 Todo 하나만 bulk 대상으로 남긴다", () => {
    const overdue = [
      todo("older", "테스트", "2026-08-20", "2026-08-20T00:00:00.000Z"),
      todo("newer", "테스트", "2026-08-23", "2026-08-23T00:00:00.000Z"),
      todo("other", "문서", "2026-08-21"),
    ];

    expect(prepareOverdueBulkImport(overdue, new Set(["older", "newer", "other"]), [])).toEqual({
      ids: ["newer", "other"],
      total: 3,
      skipped: 1,
    });
  });
});
