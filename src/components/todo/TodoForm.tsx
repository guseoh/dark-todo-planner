import { FormEvent, useEffect, useRef, useState } from "react";
import { ChevronDown, Plus } from "lucide-react";
import { todayKey } from "../../lib/date";
import type { TodoInput, TodoPriority, TodoRepeat } from "../../types/todo";

type TodoFormProps = {
  onAdd: (todo: TodoInput) => void;
  defaultDate?: string;
  compact?: boolean;
  submitLabel?: string;
};

export function TodoForm({ onAdd, defaultDate, compact = false, submitLabel = "추가" }: TodoFormProps) {
  const titleInputRef = useRef<HTMLInputElement | null>(null);
  const [title, setTitle] = useState("");
  const [memo, setMemo] = useState("");
  const [date, setDate] = useState(defaultDate || todayKey());
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [priority, setPriority] = useState<TodoPriority>("MEDIUM");
  const [repeat, setRepeat] = useState<TodoRepeat>("NONE");
  const [tags, setTags] = useState("");
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
    setRepeat("NONE");
    setTags("");
    if (compact) setShowDetails(false);
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!title.trim()) {
      titleInputRef.current?.focus();
      return;
    }

    onAdd({
      title,
      memo,
      date: date || todayKey(),
      startTime,
      endTime,
      priority,
      repeat,
      tags: tags.split(","),
    });
    reset();
    window.requestAnimationFrame(() => titleInputRef.current?.focus());
  };

  return (
    <form onSubmit={handleSubmit} className="app-card p-4">
      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          ref={titleInputRef}
          data-quick-todo-input="true"
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
          <label className="space-y-1 text-sm text-ink-400">
            반복
            <select
              className="field"
              value={repeat}
              onChange={(event) => setRepeat(event.target.value as TodoRepeat)}
            >
              <option value="NONE">반복 없음</option>
              <option value="DAILY">매일</option>
              <option value="WEEKLY">매주</option>
              <option value="MONTHLY">매월</option>
              <option value="WEEKDAY">평일만</option>
              <option value="WEEKEND">주말만</option>
            </select>
          </label>
          <label className="space-y-1 text-sm text-ink-400 xl:col-span-3">
            태그
            <input
              className="field"
              value={tags}
              onChange={(event) => setTags(event.target.value)}
              placeholder="공부, 개발, 운동"
            />
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
