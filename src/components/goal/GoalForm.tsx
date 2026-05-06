import { FormEvent, useState } from "react";
import { todayKey } from "../../lib/date";

export function GoalForm({
  onAdd,
}: {
  onAdd: (input: { title: string; description?: string; dueDate: string; progress: number }) => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState(todayKey());
  const [progress, setProgress] = useState(0);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!title.trim()) return;
    onAdd({ title, description, dueDate, progress });
    setTitle("");
    setDescription("");
    setDueDate(todayKey());
    setProgress(0);
  };

  return (
    <form onSubmit={submit} className="app-card p-5">
      <h3 className="text-lg font-bold text-ink-100">목표 추가</h3>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <input className="field" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="목표 제목" />
        <input className="field" type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
        <input
          className="field md:col-span-2"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="간단한 설명"
        />
        <label className="space-y-2 text-sm text-ink-400 md:col-span-2">
          진행률 {progress}%
          <input
            type="range"
            min="0"
            max="100"
            value={progress}
            onChange={(event) => setProgress(Number(event.target.value))}
            className="w-full accent-accent-500"
          />
        </label>
      </div>
      <button type="submit" className="btn-primary mt-4 w-full sm:w-auto">
        목표 저장
      </button>
    </form>
  );
}
