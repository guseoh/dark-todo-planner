import { FormEvent, useEffect, useState } from "react";
import { ChevronDown, Plus } from "lucide-react";
import { todayKey } from "../../lib/date";
import type { TodoInput, TodoPriority } from "../../types/todo";

type TodoFormProps = {
  onAdd: (todo: TodoInput) => void;
  defaultDate?: string;
  compact?: boolean;
  submitLabel?: string;
};

export function TodoForm({ onAdd, defaultDate, compact = false, submitLabel = "추가" }: TodoFormProps) {
  const [title, setTitle] = useState("");
  const [memo, setMemo] = useState("");
  const [date, setDate] = useState(defaultDate || todayKey());
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [priority, setPriority] = useState<TodoPriority>("MEDIUM");
  const [showDetails, setShowDetails] = useState(!compact);

  useEffect(() => {
    setDate(defaultDate || todayKey());
  }, [defaultDate]);

  const reset = () => {
    setTitle("");
    setMemo("");
    setDate(defaultDate || todayKey());
    setStartTime("");
    setEndTime("");
    setPriority("MEDIUM");
    if (compact) setShowDetails(false);
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!title.trim()) return;

    onAdd({
      title,
      memo,
      date: date || todayKey(),
      startTime,
      endTime,
      priority,
    });
    reset();
  };

  return (
    <form onSubmit={handleSubmit} className="app-card p-4">
      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          className="field flex-1"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="할 일을 빠르게 입력하세요"
          aria-label="Todo 제목"
        />
        <div className="flex gap-2">
          <button
            type="button"
            className="btn-secondary px-3"
            onClick={() => setShowDetails((value) => !value)}
            aria-expanded={showDetails}
          >
            <ChevronDown className={`transition ${showDetails ? "rotate-180" : ""}`} size={17} />
            상세
          </button>
          <button type="submit" className="btn-primary">
            <Plus size={18} />
            {submitLabel}
          </button>
        </div>
      </div>

      {showDetails ? (
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <label className="space-y-1 text-sm text-ink-400">
            날짜
            <input
              className="field"
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
            />
          </label>
          <label className="space-y-1 text-sm text-ink-400">
            시작 시간
            <input
              className="field"
              type="time"
              value={startTime}
              onChange={(event) => setStartTime(event.target.value)}
            />
          </label>
          <label className="space-y-1 text-sm text-ink-400">
            종료 시간
            <input
              className="field"
              type="time"
              value={endTime}
              onChange={(event) => setEndTime(event.target.value)}
            />
          </label>
          <label className="space-y-1 text-sm text-ink-400">
            우선순위
            <select
              className="field"
              value={priority}
              onChange={(event) => setPriority(event.target.value as TodoPriority)}
            >
              <option value="LOW">낮음</option>
              <option value="MEDIUM">보통</option>
              <option value="HIGH">높음</option>
            </select>
          </label>
          <label className="space-y-1 text-sm text-ink-400 md:col-span-2 xl:col-span-4">
            메모
            <textarea
              className="field min-h-24 resize-y"
              value={memo}
              onChange={(event) => setMemo(event.target.value)}
              placeholder="간단한 메모를 남겨두세요"
            />
          </label>
        </div>
      ) : null}
    </form>
  );
}
