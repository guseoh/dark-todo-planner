import { describe, expect, it } from "vitest";
import { learningImportItemSchema, learningStatusSchema } from "./learningValidation";

describe("learning validation", () => {
  it("accepts a Notion daily problem import", () => {
    const item = learningImportItemSchema.parse({
      learningDate: "2026-08-17",
      type: "DAILY_PROBLEM",
      title: "CR-2026-08-17",
      summary: "Java · Spring · 설계 코드 읽기",
      sourceUrl: "https://www.notion.so/example",
      sourceName: "Notion",
      externalKey: "notion:CR-2026-08-17",
    });
    expect(item.type).toBe("DAILY_PROBLEM");
    expect(item.externalKey).toBe("notion:CR-2026-08-17");
  });

  it("rejects unsafe source URL protocols", () => {
    expect(() => learningImportItemSchema.parse({
      learningDate: "2026-08-17",
      type: "TECH_BLOG",
      title: "읽을 글",
      sourceUrl: "javascript:alert(1)",
      externalKey: "blog:1",
    })).toThrow();
  });

  it("accepts the four learning statuses", () => {
    for (const status of ["UNREAD", "READING", "DONE", "SKIPPED"]) {
      expect(learningStatusSchema.parse({ status }).status).toBe(status);
    }
  });
});
