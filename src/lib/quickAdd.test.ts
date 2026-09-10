import { describe, expect, it } from "vitest";
import { parseQuickTodoTitle } from "./quickAdd";

const context = {
  projects: [
    { id: "project-pawcycle", name: "PawCycle" },
    { id: "project-board", name: "Large Scale Board" },
  ],
  categories: [
    { id: "category-backend", name: "백엔드" },
    { id: "category-study", name: "공부 기록" },
  ],
};

describe("parseQuickTodoTitle", () => {
  it("extracts date, priority and deadline tokens", () => {
    expect(parseQuickTodoTitle("내일 JPA 정리 !high due:2026-08-20", "2026-08-16")).toEqual({
      title: "JPA 정리",
      date: "2026-08-17",
      dueDate: "2026-08-20",
      priority: "HIGH",
      planningState: "SCHEDULED",
    });
  });

  it("moves an item to Inbox without forcing a schedule date", () => {
    expect(parseQuickTodoTitle("inbox 아이디어", "2026-08-16")).toEqual({
      title: "아이디어",
      planningState: "INBOX",
    });
  });

  it("supports Korean planning tokens and priority", () => {
    expect(parseQuickTodoTitle("언젠가 책 읽기 !low", "2026-08-16")).toEqual({
      title: "책 읽기",
      priority: "LOW",
      planningState: "SOMEDAY",
    });
  });

  it("resolves project and category tokens from the current planner context", () => {
    expect(parseQuickTodoTitle("로그인 구현 @pawcycle +백엔드 !high", "2026-08-16", context)).toEqual({
      title: "로그인 구현",
      priority: "HIGH",
      categoryId: "category-backend",
      projectId: "project-pawcycle",
    });
  });

  it("supports braced names with spaces", () => {
    expect(parseQuickTodoTitle("성능 회고 @{Large Scale Board} +{공부 기록}", "2026-08-16", context)).toEqual({
      title: "성능 회고",
      categoryId: "category-study",
      projectId: "project-board",
    });
  });

  it("supports explicit schedule dates and relative deadline values", () => {
    expect(parseQuickTodoTitle("배포 확인 date:2026-08-19 due:내일", "2026-08-16")).toEqual({
      title: "배포 확인",
      date: "2026-08-19",
      dueDate: "2026-08-17",
      planningState: "SCHEDULED",
    });
  });

  it("keeps retired tag, estimate and repeat tokens as plain title text", () => {
    expect(parseQuickTodoTitle("JPA 정리 #공부 45m repeat:weekly", "2026-08-16")).toEqual({
      title: "JPA 정리 #공부 45m repeat:weekly",
    });
  });

  it("keeps unknown project and category tokens in the title instead of discarding them", () => {
    expect(parseQuickTodoTitle("문서 정리 @Unknown +기타", "2026-08-16", context)).toEqual({
      title: "문서 정리 @Unknown +기타",
    });
  });
});
