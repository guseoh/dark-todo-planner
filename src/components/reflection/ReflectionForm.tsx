import { FormEvent, useState } from "react";
import { todayKey } from "../../lib/date";
import type { ReflectionType } from "../../types/reflection";

const templates: Record<ReflectionType, string> = {
  DAILY: "- 오늘 잘한 점\n- 아쉬운 점\n- 내일 할 일",
  WEEKLY: "- 이번 주 완료한 것\n- 미룬 것\n- 다음 주 목표",
  MONTHLY: "- 이번 달 잘한 점\n- 다음 달 목표",
};

export function ReflectionForm({
  onAdd,
}: {
  onAdd: (input: { date: string; type: ReflectionType; content: string }) => void;
}) {
  const [type, setType] = useState<ReflectionType>("DAILY");
  const [date, setDate] = useState(todayKey());
  const [content, setContent] = useState(templates.DAILY);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!content.trim()) return;
    onAdd({ date, type, content });
    setContent(templates[type]);
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
            setContent(templates[nextType]);
          }}
        >
          <option value="DAILY">오늘 회고</option>
          <option value="WEEKLY">주간 회고</option>
          <option value="MONTHLY">월간 회고</option>
        </select>
        <input className="field" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
      </div>
      <textarea
        className="field mt-3 min-h-40 resize-y"
        value={content}
        onChange={(event) => setContent(event.target.value)}
      />
      <button type="submit" className="btn-primary mt-4 w-full sm:w-auto">
        회고 저장
      </button>
    </form>
  );
}
