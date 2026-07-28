import { createId } from "../../lib/id";
import type { Reflection, ReflectionSection, ReflectionType } from "../../types/reflection";

const templates: Record<ReflectionType, string[]> = {
  DAILY: ["오늘 잘한 점", "아쉬운 점", "내일 할 일"],
  WEEKLY: ["이번 주 완료한 것", "이번 주 아쉬웠던 것", "다음 주 목표"],
  MONTHLY: ["이번 달 잘한 점", "이번 달 아쉬웠던 점", "다음 달 목표"],
};

type ReflectionFormInitial = Pick<Reflection, "type" | "sections" | "content">;

const createSections = (type: ReflectionType, current: ReflectionSection[] = []): ReflectionSection[] =>
  templates[type].map((title, order) => ({
    id: current[order]?.id || createId(),
    title,
    content: current[order]?.content || "",
    order,
  }));

export function buildInitialReflectionSections(initial?: ReflectionFormInitial): ReflectionSection[] {
  if (initial?.sections.length) {
    return initial.sections.map((section) => ({ ...section }));
  }

  if (initial?.content?.trim()) {
    return [
      {
        id: createId(),
        title: "기존 회고 내용",
        content: initial.content,
        order: 0,
      },
    ];
  }

  return createSections(initial?.type || "DAILY");
}

export function changeReflectionType(
  currentSections: ReflectionSection[],
  nextType: ReflectionType,
): ReflectionSection[] {
  return createSections(nextType, currentSections);
}
