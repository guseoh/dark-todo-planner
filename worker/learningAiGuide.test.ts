import { describe, expect, it } from "vitest";
import {
  buildLearningGuidePrompt,
  buildLearningGuideSource,
  extractStructuredGuide,
  hashLearningGuideSource,
  structuredGuideToMarkdown,
  type StructuredLearningGuide,
} from "./learningAiGuide";
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

const structured: StructuredLearningGuide = {
  keyPoints: ["복합 인덱스를 적용했다.", "실행 계획을 비교했다.", "p95 응답 시간을 비교했다."],
  checkQuestions: ["어떤 인덱스를 적용했나요?", "실행 계획 비교가 필요한 이유는 무엇인가요?", "운영에서 어떤 응답 시간을 확인해야 하나요?"],
  projectQuestion: "현재 프로젝트에서도 인덱스 변경 전후의 p95를 측정할 수 있나요?",
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

  it("describes structured fields and grounding rules in the prompt", () => {
    const prompt = buildLearningGuidePrompt(buildLearningGuideSource(item));
    expect(prompt).toContain("자료에 없는 사실");
    expect(prompt).toContain("keyPoints");
    expect(prompt).toContain("checkQuestions");
    expect(prompt).toContain("projectQuestion");
    expect(prompt).toContain("Markdown 제목이나 번호를 값 안에 넣지 마세요");
  });

  it("extracts a structured Workers AI JSON response", () => {
    expect(extractStructuredGuide({ response: structured })).toEqual(structured);
    expect(extractStructuredGuide({ response: JSON.stringify(structured) })).toEqual(structured);
  });

  it("rejects incomplete structured output", () => {
    expect(extractStructuredGuide({ response: { ...structured, checkQuestions: structured.checkQuestions.slice(0, 2) } })).toBeNull();
    expect(extractStructuredGuide({ response: { ...structured, keyPoints: [] } })).toBeNull();
    expect(extractStructuredGuide({ response: "not json" })).toBeNull();
  });

  it("converts structured output into stable Markdown numbering", () => {
    const markdown = structuredGuideToMarkdown(structured);
    expect(markdown).toContain("## 핵심 이해 포인트");
    expect(markdown).toContain("1. 어떤 인덱스를 적용했나요?");
    expect(markdown).toContain("2. 실행 계획 비교가 필요한 이유는 무엇인가요?");
    expect(markdown).toContain("3. 운영에서 어떤 응답 시간을 확인해야 하나요?");
    expect(markdown).toContain("## 프로젝트 적용 질문");
  });
});
