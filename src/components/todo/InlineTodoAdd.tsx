import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from "react";
import { Plus } from "lucide-react";
import type { TodoInput } from "../../types/todo";
import { todayKey } from "../../lib/date";

type InlineTodoAddProps = {
  categoryId?: string;
  defaultDate?: string;
  layout?: "inline" | "stacked";
  placeholder?: string;
  onAdd: (todo: TodoInput) => void;
  onCancel: () => void;
};

export function InlineTodoAdd({ categoryId, defaultDate, layout = "inline", placeholder = "하위 Todo 입력 후 Enter", onAdd, onCancel }: InlineTodoAddProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [title, setTitle] = useState("");

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const submit = (event?: FormEvent) => {
    event?.preventDefault();
    if (!title.trim()) {
      inputRef.current?.focus();
      return;
    }
    onAdd({
      title: title.trim(),
      categoryId,
      date: defaultDate || todayKey(),
      priority: "MEDIUM",
      repeat: "NONE",
      tags: [],
    });
    setTitle("");
    window.requestAnimationFrame(() => titleInputRefFocus());
  };

  const titleInputRefFocus = () => inputRef.current?.focus();

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      onCancel();
    }
  };

  return (
    <form
      onSubmit={submit}
      className={`${layout === "stacked" ? "flex-col" : ""} flex gap-2 rounded-lg border border-dashed border-ink-700 bg-ink-950/35 p-1.5`}
    >
      <input
        ref={inputRef}
        className="field min-h-9 min-w-0 flex-1 py-1.5"
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        aria-label="Todo 제목"
      />
      <button
        type="submit"
        className={`btn-secondary min-h-9 px-3 py-1.5 ${layout === "stacked" ? "w-full justify-center" : ""}`}
      >
        <Plus size={16} />
        추가
      </button>
    </form>
  );
}
