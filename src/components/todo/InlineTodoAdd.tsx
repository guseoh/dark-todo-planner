import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from "react";
import { Plus } from "lucide-react";
import type { TodoInput } from "../../types/todo";
import { todayKey } from "../../lib/date";

type InlineTodoAddProps = {
  categoryId?: string;
  defaultDate?: string;
  onAdd: (todo: TodoInput) => void;
  onCancel: () => void;
};

export function InlineTodoAdd({ categoryId, defaultDate, onAdd, onCancel }: InlineTodoAddProps) {
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
    window.requestAnimationFrame(() => inputRef.current?.focus());
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      onCancel();
    }
  };

  return (
    <form onSubmit={submit} className="flex gap-2 rounded-lg border border-dashed border-ink-700 bg-ink-950/35 p-2">
      <input
        ref={inputRef}
        className="field min-h-10 flex-1"
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="하위 Todo 입력 후 Enter"
        aria-label="하위 Todo 제목"
      />
      <button type="submit" className="btn-secondary min-h-10 px-3">
        <Plus size={16} />
        추가
      </button>
    </form>
  );
}
