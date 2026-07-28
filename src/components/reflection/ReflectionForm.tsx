import { FormEvent, useEffect, useState } from "react";
import { createId } from "../../lib/id";
import { todayKey } from "../../lib/date";
import type { Reflection, ReflectionSection, ReflectionType } from "../../types/reflection";
import { MarkdownEditor } from "../editor/MarkdownEditor";

const templates: Record<ReflectionType, string[]> = {
  DAILY: ["오늘 잘한 점", "아쉬운 점", "내일 할 일"],
  WEEKLY: ["이번 주 완료한 것", "이번 주 아쉬웠던 것", "다음 주 목표"],
  MONTHLY: ["이번 달 잘한 점", "이번 달 아쉬웠던 점", "다음 달 목표"],
};

const createSections = (type: ReflectionType, current: ReflectionSection[] = []): ReflectionSection[] =>
  templates[type].map((title, order) => ({
    id: current[order]?.id || createId(),
    title,
    content: current[order]?.content || "",
    order,
  }));

export function ReflectionForm({
  initial,
  submitLabel = "회고 저장",
  onSubmit,
  onCancel,
}: {
  initial?: Pick<Reflection, "date" | "type" | "sections">;
  submitLabel?: string;
  onSubmit: (input: { date: string; type: ReflectionType; sections: ReflectionSection[]; content?: string }) => unknown | Promise<unknown>;
  onCancel: () => void;
}) {
  const initialType = initial?.type || "DAILY";
  const [type, setType] = useState<ReflectionType>(initialType);
  const [date, setDate] = useState(initial?.date || todayKey());
  const [sections, setSections] = useState<ReflectionSection[]>(
    initial?.sections.length ? initial.sections.map((section) => ({ ...section })) : createSections(initialType),
  );
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const nextType = initial?.type || "DAILY";
    setType(nextType);
    setDate(initial?.date || todayKey());
    setSections(
      initial?.sections.length ? initial.sections.map((section) => ({ ...section })) : createSections(nextType),
    );
  }, [initial]);

  const canSubmit = Boolean(date && sections.some((section) => section.content.trim()));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    try {
      await onSubmit({
        date,
        type,
        sections,
        content: sections.map((section) => `${section.title}\n${section.content}`).join("\n\n"),
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block space-y-1 text-sm font-semibold text-ink-300">
          회고 유형
          <select
            className="field min-h-11"
            value={type}
            onChange={(event) => {
              const nextType = event.target.value as ReflectionType;
              setType(nextType);
              setSections((current) => createSections(nextType, current));
            }}
          >
            <option value="DAILY">일간 회고</option>
            <option value="WEEKLY">주간 회고</option>
            <option value="MONTHLY">월간 회고</option>
          </select>
        </label>
        <label className="block space-y-1 text-sm font-semibold text-ink-300">
          날짜
          <input
            className="field min-h-11"
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            required
          />
        </label>
      </div>
      <div className="space-y-4">
        {sections.map((section) => (
          <MarkdownEditor
            key={section.id}
            label={section.title}
            value={section.content}
            onChange={(value) =>
                setSections((current) =>
                  current.map((item) => (item.id === section.id ? { ...item, content: value } : item)),
                )
            }
          />
        ))}
      </div>
      <p className="text-xs text-ink-500">한 개 이상의 항목을 작성하면 저장할 수 있습니다. 비워 둔 항목은 그대로 유지됩니다.</p>
      <div className="flex flex-col-reverse gap-2 border-t border-ink-700 pt-4 sm:flex-row sm:justify-end">
        <button type="button" className="btn-secondary justify-center" onClick={onCancel} disabled={submitting}>
          취소
        </button>
        <button type="submit" className="btn-primary justify-center" disabled={!canSubmit || submitting}>
          {submitting ? "저장 중..." : submitLabel}
        </button>
      </div>
    </form>
  );
}
