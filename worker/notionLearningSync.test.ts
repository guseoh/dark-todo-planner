import { describe, expect, it } from "vitest";
import { codeReadingPageToLearning, getKstDate, techBlogPageToLearning } from "./notionLearningSync";
import type { NotionPage } from "./notionClient";

const title = (value: string) => ({ type: "title", title: [{ plain_text: value }] });
const text = (value: string) => ({ type: "rich_text", rich_text: [{ plain_text: value }] });
const select = (value: string) => ({ type: "select", select: { name: value } });
const url = (value: string) => ({ type: "url", url: value });

const page = (properties: Record<string, unknown>, id = "3be7c8e3-1236-8153-b650-ff401c5d46fb"): NotionPage => ({
  id,
  url: `https://www.notion.so/${id.replaceAll("-", "")}`,
  properties,
});

describe("Notion Learning sync mapping", () => {
  it("uses Asia/Seoul date", () => {
    expect(getKstDate(new Date("2026-08-16T15:05:00.000Z"))).toBe("2026-08-17");
  });

  it("maps the daily code reading page", () => {
    const item = codeReadingPageToLearning(page({
      "세트 ID": title("CR-2026-08-17"),
      "Java 주제": text("HashSet 중복 추가"),
      "Spring 주제": text("@PostMapping"),
      "설계 주제": text("상태 변경 책임"),
      "상태": select("해설 완료"),
    }), "2026-08-17");

    expect(item.type).toBe("DAILY_PROBLEM");
    expect(item.title).toBe("CR-2026-08-17");
    expect(item.summary).toContain("Java: HashSet 중복 추가");
    expect(item.summary).toContain("Notion 상태: 해설 완료");
    expect(item.externalKey).toBe("notion:3be7c8e312368153b650ff401c5d46fb");
  });

  it("maps one technical blog row to one Learning item", () => {
    const item = techBlogPageToLearning(page({
      "제목": title("느린 PR, 빠른 개발"),
      "요약": text("PR 리뷰 병목을 다룬다."),
      "읽을 가치": text("AI 시대 리뷰 속도를 생각해볼 수 있다."),
      "적용 포인트": text("PawCycle PR 흐름에 적용"),
      "출처": text("카카오페이 기술 블로그"),
      "원문 URL": url("https://example.com/article"),
    }, "11111111-2222-3333-4444-555555555555"), "2026-08-17");

    expect(item).not.toBeNull();
    expect(item?.type).toBe("TECH_BLOG");
    expect(item?.sourceUrl).toBe("https://example.com/article");
    expect(item?.sourceName).toBe("카카오페이 기술 블로그");
    expect(item?.summary).toContain("읽을 가치:");
    expect(item?.summary).toContain("적용 포인트:");
  });
});
