import { FormEvent, useEffect, useState } from "react";
import { X } from "lucide-react";
import type { Category } from "../../types/category";
import type { Todo, TodoPriority, TodoRepeat } from "../../types/todo";
import { MarkdownEditor } from "../editor/MarkdownEditor";

type TodoEditModalProps = {
  todo: Todo | null;
  categories?: Category[];
  onClose: () => void;
  onSave: (id: string, updates: Partial<Omit<Todo, "id" | "createdAt">>) => void;
};

export function TodoEditModal({ todo, categories = [], onClose, onSave }: TodoEditModalProps) {
  const [title, setTitle] = useState("");
  const [memo, setMemo] = useState("");
  const [date, setDate] = useState("");
  const [priority, setPriority] = useState<TodoPriority>("MEDIUM");
  const [repeat, setRepeat] = useState<TodoRepeat>("NONE");
  const [tags, setTags] = useState("");
  const [completed, setCompleted] = useState(false);
  const [categoryId, setCategoryId] = useState("");

  useEffect(() => {
    if (!todo) return;
    setTitle(todo.title);
    setMemo(todo.memo || "");
    setDate(todo.date);
    setPriority(todo.priority);
    setRepeat(todo.repeat || "NONE");
    setTags((todo.tags || []).join(", "));
    setCompleted(todo.completed);
    setCategoryId(todo.categoryId || "");
  }, [todo]);

  useEffect(() => {
    if (!todo) return undefined;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose, todo]);

  if (!todo) return null;

  const saveTodo = () => {
    if (!title.trim()) return;

    onSave(todo.id, {
      title,
      categoryId: categoryId || undefined,
      memo,
      date,
      priority,
      repeat,
      tags: tags.split(","),
      completed,
      updatedAt: new Date().toISOString(),
    });
    onClose();
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    saveTodo();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-3 sm:items-center">
      <form
        onSubmit={handleSubmit}
        className="app-card w-full max-w-2xl p-5"
      >
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-ink-100">Todo 수정</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="닫기">
            <X size={18} />
          </button>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2">
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
            카테고리
            <select className="field" value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
              <option value="">미분류</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
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
          <label className="space-y-1 text-sm text-ink-400">
            태그
            <input
              className="field"
              value={tags}
              onChange={(event) => setTags(event.target.value)}
              placeholder="공부, 개발, 운동"
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
          <MarkdownEditor className="md:col-span-2" label="메모" value={memo} onChange={setMemo} placeholder="메모" />
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
