import { FormEvent, useState } from "react";
import { createId } from "../../lib/id";
import { todayKey } from "../../lib/date";
import type { ReflectionSection, ReflectionType } from "../../types/reflection";

const templates: Record<ReflectionType, string[]> = {
  DAILY: ["오늘 잘한 점", "아쉬운 점", "내일 할 일", "메모"],
  WEEKLY: ["이번 주 완료한 것", "이번 주 아쉬웠던 것", "다음 주 목표", "메모"],
  MONTHLY: ["이번 달 잘한 점", "이번 달 아쉬웠던 점", "다음 달 목표", "메모"],
};

const createSections = (type: ReflectionType): ReflectionSection[] =>
  templates[type].map((title, order) => ({ id: createId(), title, content: "", order }));

export function ReflectionForm({
  onAdd,
}: {
  onAdd: (input: { date: string; type: ReflectionType; sections: ReflectionSection[]; content?: string }) => void;
}) {
  const [type, setType] = useState<ReflectionType>("DAILY");
  const [date, setDate] = useState(todayKey());
  const [sections, setSections] = useState<ReflectionSection[]>(createSections("DAILY"));

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!sections.some((section) => section.content.trim())) return;
    onAdd({ date, type, sections, content: sections.map((section) => `${section.title}\n${section.content}`).join("\n\n") });
    setSections(createSections(type));
  };

  return (
    <form onSubmit={submit} className="app-card p-5">
      <h3 className="text-lg font-bold text-ink-100">회고 작성</h3>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <select
          className="field"
          value={type}
          onChange={(event) => {
            const nextType = event.target.value as ReflectionType;
            setType(nextType);
            setSections(createSections(nextType));
          }}
        >
          <option value="DAILY">일간 회고</option>
          <option value="WEEKLY">주간 회고</option>
          <option value="MONTHLY">월간 회고</option>
        </select>
        <input className="field" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
      </div>
      <div className="mt-4 space-y-4">
        {sections.map((section) => (
          <label key={section.id} className="block space-y-2 text-sm font-semibold text-ink-200">
            {section.title}
            <textarea
              className="field min-h-24 resize-y"
              value={section.content}
              onChange={(event) =>
                setSections((current) =>
                  current.map((item) => (item.id === section.id ? { ...item, content: event.target.value } : item)),
                )
              }
            />
          </label>
        ))}
      </div>
      <button type="submit" className="btn-primary mt-4 w-full sm:w-auto">
        회고 저장
      </button>
    </form>
  );
}
