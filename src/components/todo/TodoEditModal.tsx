import { FormEvent, useEffect, useState } from "react";
import { X } from "lucide-react";
import type { Todo, TodoPriority } from "../../types/todo";

type TodoEditModalProps = {
  todo: Todo | null;
  onClose: () => void;
  onSave: (id: string, updates: Partial<Omit<Todo, "id" | "createdAt">>) => void;
};

export function TodoEditModal({ todo, onClose, onSave }: TodoEditModalProps) {
  const [title, setTitle] = useState("");
  const [memo, setMemo] = useState("");
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [priority, setPriority] = useState<TodoPriority>("MEDIUM");
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    if (!todo) return;
    setTitle(todo.title);
    setMemo(todo.memo || "");
    setDate(todo.date);
    setStartTime(todo.startTime || "");
    setEndTime(todo.endTime || "");
    setPriority(todo.priority);
    setCompleted(todo.completed);
  }, [todo]);

  if (!todo) return null;

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!title.trim()) return;

    onSave(todo.id, {
      title,
      memo,
      date,
      startTime,
      endTime,
      priority,
      completed,
      updatedAt: new Date().toISOString(),
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-3 sm:items-center">
      <form onSubmit={handleSubmit} className="app-card w-full max-w-2xl p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-ink-100">Todo 수정</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="닫기">
            <X size={18} />
          </button>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <label className="space-y-1 text-sm text-ink-400 md:col-span-2">
            제목
            <input
              className="field"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Todo 제목"
            />
          </label>
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
          <label className="flex min-h-11 items-center gap-3 rounded-lg border border-ink-700 bg-ink-950/60 px-3 text-sm text-ink-300 md:col-span-2">
            <input
              type="checkbox"
              checked={completed}
              onChange={(event) => setCompleted(event.target.checked)}
              className="h-4 w-4 accent-accent-500"
            />
            완료된 Todo로 표시
          </label>
          <label className="space-y-1 text-sm text-ink-400 md:col-span-2">
            메모
            <textarea
              className="field min-h-28 resize-y"
              value={memo}
              onChange={(event) => setMemo(event.target.value)}
              placeholder="메모"
            />
          </label>
        </div>

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" className="btn-secondary" onClick={onClose}>
            취소
          </button>
          <button type="submit" className="btn-primary">
            저장
          </button>
        </div>
      </form>
    </div>
  );
}
