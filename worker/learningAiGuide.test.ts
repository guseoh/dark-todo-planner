import { describe, expect, it } from "vitest";
import { buildLearningGuidePrompt, buildLearningGuideSource, extractAiText, hashLearningGuideSource } from "./learningAiGuide";
import type { LearningRow } from "./learningStore";

const item: LearningRow = {
  id: "learning-1",
  userId: "single-user",
  learningDate: "2026-08-18",
  type: "TECH_BLOG",
  title: "느린 쿼리 개선 사례",
  summary: "복합 인덱스 적용 전후의 실행 계획과 p95 응답 시간을 비교했다.",
  sourceUrl: "https://example.com/post",
  sourceName: "Example Tech",
  categories: ["DB·데이터", "성능"],
  status: "UNREAD",
  externalKey: "notion:1",
  todoId: null,
  createdAt: "2026-08-18T00:00:00.000Z",
  updatedAt: "2026-08-18T00:00:00.000Z",
};

describe("Learning AI guide helpers", () => {
  it("builds a source that stays grounded in the Learning item", () => {
    const source = buildLearningGuideSource(item);
    expect(source).toContain("느린 쿼리 개선 사례");
    expect(source).toContain("DB·데이터, 성능");
    expect(source).toContain("p95 응답 시간");
    expect(source).not.toContain(item.sourceUrl || "");
  });

  it("changes the source hash when synced content changes", async () => {
    const first = await hashLearningGuideSource(buildLearningGuideSource(item));
    const second = await hashLearningGuideSource(buildLearningGuideSource({ ...item, summary: `${item.summary} 인덱스 선택도도 확인했다.` }));
    expect(first).toMatch(/^[a-f0-9]{64}$/);
    expect(second).not.toBe(first);
  });

  it("explicitly prevents unsupported facts in the prompt", () => {
    const prompt = buildLearningGuidePrompt(buildLearningGuideSource(item));
    expect(prompt).toContain("자료에 없는 사실");
    expect(prompt).toContain("## 확인 질문");
    expect(prompt).toContain("## 프로젝트 적용 질문");
  });

  it("extracts common Workers AI response shapes", () => {
    expect(extractAiText({ response: "가이드" })).toBe("가이드");
    expect(extractAiText("문자열 응답")).toBe("문자열 응답");
    expect(extractAiText({ response: ["첫 줄", "둘째 줄"] })).toBe("첫 줄\n둘째 줄");
  });
});
