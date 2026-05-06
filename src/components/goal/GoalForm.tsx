import { FormEvent, useState } from "react";
import { endOfWeek, format, startOfWeek } from "date-fns";
import { todayKey } from "../../lib/date";
import type { Goal, GoalType } from "../../types/goal";

const weekOptions = { weekStartsOn: 1 as const };

export function GoalForm({
  activeType,
  onAdd,
}: {
  activeType: GoalType;
  onAdd: (input: Partial<Goal> & { title: string }) => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(todayKey());
  const [month, setMonth] = useState(todayKey().slice(0, 7));
  const [progress, setProgress] = useState(0);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!title.trim()) return;
    const baseDate = new Date(date);
    const weekStartDate = format(startOfWeek(baseDate, weekOptions), "yyyy-MM-dd");
    const weekEndDate = format(endOfWeek(baseDate, weekOptions), "yyyy-MM-dd");
    onAdd({
      title,
      description,
      type: activeType,
      targetDate: activeType === "DAILY" ? date : undefined,
      weekStartDate: activeType === "WEEKLY" ? weekStartDate : undefined,
      weekEndDate: activeType === "WEEKLY" ? weekEndDate : undefined,
      month: activeType === "MONTHLY" ? month : undefined,
      dueDate: activeType === "DAILY" ? date : activeType === "WEEKLY" ? weekEndDate : `${month}-01`,
      progress,
      completed: false,
    });
    setTitle("");
    setDescription("");
    setProgress(0);
  };

  return (
    <form onSubmit={submit} className="app-card p-5">
      <h3 className="text-lg font-bold text-ink-100">
        {activeType === "DAILY" ? "일간 목표" : activeType === "WEEKLY" ? "주간 목표" : "월간 목표"} 추가
      </h3>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <input className="field" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="목표 제목" />
        {activeType === "MONTHLY" ? (
          <input className="field" type="month" value={month} onChange={(event) => setMonth(event.target.value)} />
        ) : (
          <input className="field" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        )}
        <input className="field md:col-span-2" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="간단한 설명" />
        <label className="space-y-2 text-sm text-ink-400 md:col-span-2">
          진행률 {progress}%
          <input type="range" min="0" max="100" value={progress} onChange={(event) => setProgress(Number(event.target.value))} className="w-full accent-accent-500" />
        </label>
      </div>
      <button type="submit" className="btn-primary mt-4 w-full sm:w-auto">목표 저장</button>
    </form>
  );
}
