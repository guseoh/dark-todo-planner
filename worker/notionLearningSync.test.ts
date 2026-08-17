import { describe, expect, it } from "vitest";
import { codeReadingPageToLearning, getKstDate, techBlogPageToLearning } from "./notionLearningSync";
import type { NotionPage } from "./notionClient";

const title = (value: string) => ({ type: "title", title: [{ plain_text: value }] });
const text = (value: string) => ({ type: "rich_text", rich_text: [{ plain_text: value }] });
const select = (value: string) => ({ type: "select", select: { name: value } });
const multiSelect = (...values: string[]) => ({ type: "multi_select", multi_select: values.map((name) => ({ name })) });
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

  it("maps technical blog body and multi-select categories", () => {
    const item = techBlogPageToLearning(page({
      "제목": title("MongoDB 8.0 업그레이드 해야하는 12가지 이유"),
      "유형": multiSelect("DB·데이터", "성능"),
      "원문 URL": url("https://tech.kakao.com/posts/803"),
    }, "11111111-2222-3333-4444-555555555555"), "2026-08-17", [
      "Kakao Tech · 2025년 12월 17일",
      "한 줄 정리",
      "MongoDB 8.0은 성능 개선과 읽기 정합성을 함께 검증해야 합니다.",
      "핵심 내용",
      "• 성능: 쓰기 처리량이 약 30~47% 증가했습니다.",
      "• 주의점: Secondary 읽기 정합성을 확인해야 합니다.",
      "원문",
      "MongoDB 8.0 업그레이드 해야하는 12가지 이유",
    ].join("\n"));

    expect(item).not.toBeNull();
    expect(item?.type).toBe("TECH_BLOG");
    expect(item?.sourceUrl).toBe("https://tech.kakao.com/posts/803");
    expect(item?.sourceName).toBe("Kakao Tech");
    expect(item?.categories).toEqual(["DB·데이터", "성능"]);
    expect(item?.summary).toContain("30~47%");
    expect(item?.summary).not.toContain("Kakao Tech ·");
    expect(item?.summary).not.toContain("\n원문\n");
  });

  it("keeps legacy property mapping as a fallback when body is unavailable", () => {
    const item = techBlogPageToLearning(page({
      "제목": title("느린 PR, 빠른 개발"),
      "요약": text("PR 리뷰 병목을 다룬다."),
      "읽을 가치": text("AI 시대 리뷰 속도를 생각해볼 수 있다."),
      "적용 포인트": text("PawCycle PR 흐름에 적용"),
      "출처": text("카카오페이 기술 블로그"),
      "원문 URL": url("https://example.com/article"),
    }, "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"), "2026-08-17");

    expect(item?.sourceName).toBe("카카오페이 기술 블로그");
    expect(item?.summary).toContain("읽을 가치:");
    expect(item?.summary).toContain("적용 포인트:");
  });
});
