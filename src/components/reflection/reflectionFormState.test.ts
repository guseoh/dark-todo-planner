import { describe, expect, it } from "vitest";
import type { ReflectionSection } from "../../types/reflection";
import {
  buildInitialReflectionSections,
  changeReflectionType,
} from "./reflectionFormState";

describe("reflection form state", () => {
  it("preserves and copies existing sections", () => {
    const sections: ReflectionSection[] = [
      { id: "section-1", title: "잘한 점", content: "꾸준히 했다", order: 0 },
    ];

    const result = buildInitialReflectionSections({ type: "DAILY", sections, content: "legacy" });

    expect(result).toEqual(sections);
    expect(result).not.toBe(sections);
    expect(result[0]).not.toBe(sections[0]);
  });

  it("uses legacy content when sections are empty", () => {
    const result = buildInitialReflectionSections({
      type: "WEEKLY",
      sections: [],
      content: "지워지면 안 되는 기존 회고",
    });

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      title: "기존 회고 내용",
      content: "지워지면 안 되는 기존 회고",
      order: 0,
    });
  });

  it("uses the selected type template when both sections and content are missing", () => {
    const result = buildInitialReflectionSections({ type: "MONTHLY", sections: [], content: undefined });

    expect(result.map(({ title, content, order }) => ({ title, content, order }))).toEqual([
      { title: "이번 달 잘한 점", content: "", order: 0 },
      { title: "이번 달 아쉬웠던 점", content: "", order: 1 },
      { title: "다음 달 목표", content: "", order: 2 },
    ]);
  });

  it("does not mutate the original sections while changing type", () => {
    const sections: ReflectionSection[] = [
      { id: "section-1", title: "기존 회고 내용", content: "보존할 내용", order: 0 },
    ];
    const snapshot = structuredClone(sections);

    const result = changeReflectionType(sections, "WEEKLY");

    expect(sections).toEqual(snapshot);
    expect(result).not.toBe(sections);
  });

  it("preserves written content when the reflection type changes", () => {
    const sections: ReflectionSection[] = [
      { id: "section-1", title: "오늘 잘한 점", content: "완료한 일", order: 0 },
      { id: "section-2", title: "아쉬운 점", content: "남은 일", order: 1 },
    ];

    const result = changeReflectionType(sections, "WEEKLY");

    expect(result.map((section) => section.content)).toEqual(["완료한 일", "남은 일", ""]);
  });
});
