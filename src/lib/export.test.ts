import { describe, expect, it } from "vitest";
import { buildPlannerMarkdown, buildTodoCsv } from "./export";
import type { Todo } from "../types/todo";

const todo: Todo = {
  id: "todo-1",
  title: "CSV, 제목",
  memo: "첫 줄\n둘째 \"줄\"",
  date: "2026-08-16",
  dueDate: "2026-08-18",
  planningState: "INBOX",
  workflowStatus: "TODO",
  priority: "HIGH",
  completed: false,
  repeat: "NONE",
  tags: ["공부", "JPA"],
  archived: false,
  createdAt: "2026-08-16T00:00:00.000Z",
  updatedAt: "2026-08-16T00:00:00.000Z",
};

describe("planner export", () => {
  it("escapes CSV commas, newlines, and quotes", () => {
    const csv = buildTodoCsv([todo], []);
    expect(csv).toContain('"CSV, 제목"');
    expect(csv).toContain('"첫 줄\n둘째 ""줄"""');
    expect(csv).toContain("공부 JPA");
  });

  it("exports projectless and planning queue sections to Markdown", () => {
    const markdown = buildPlannerMarkdown({ todos: [todo], projects: [], goals: [], memos: [], exportedAt: "2026-08-16T00:00:00.000Z" });
    expect(markdown).toContain("## Todo without Project");
    expect(markdown).toContain("### INBOX");
    expect(markdown).toContain("- [ ] CSV, 제목");
  });
});
