import { describe, expect, it } from "vitest";
import { parseQuickTodoTitle } from "./quickAdd";

describe("parseQuickTodoTitle", () => {
  it("extracts date, priority, tag, estimate and deadline tokens", () => {
    expect(parseQuickTodoTitle("내일 JPA 정리 !high #공부 45m due:2026-08-20", "2026-08-16")).toEqual({
      title: "JPA 정리",
      tags: ["공부"],
      date: "2026-08-17",
      dueDate: "2026-08-20",
      estimateMinutes: 45,
      priority: "HIGH",
      planningState: "SCHEDULED",
    });
  });

  it("moves an item to Inbox without forcing a schedule date", () => {
    expect(parseQuickTodoTitle("inbox 아이디어 #pawcycle", "2026-08-16")).toEqual({
      title: "아이디어",
      tags: ["pawcycle"],
      planningState: "INBOX",
    });
  });

  it("supports Korean planning tokens and hour estimates", () => {
    expect(parseQuickTodoTitle("언젠가 책 읽기 2h !low", "2026-08-16")).toEqual({
      title: "책 읽기",
      tags: [],
      estimateMinutes: 120,
      priority: "LOW",
      planningState: "SOMEDAY",
    });
  });
});
