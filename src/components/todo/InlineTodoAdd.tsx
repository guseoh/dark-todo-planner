import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from "react";
import { Plus } from "lucide-react";
import type { Todo, TodoInput } from "../../types/todo";
import { todayKey } from "../../lib/date";

type InlineTodoAddProps = {
  categoryId?: string;
  defaultDate?: string;
  layout?: "inline" | "stacked";
  placeholder?: string;
  onAdd: (todo: TodoInput) => Promise<Todo | undefined> | Todo | undefined;
  onCancel: () => void;
};

export function InlineTodoAdd({ categoryId, defaultDate, layout = "inline", placeholder = "하위 Todo 입력 후 Enter", onAdd, onCancel }: InlineTodoAddProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const submit = async (event?: FormEvent) => {
    event?.preventDefault();
    if (saving) return;
    if (!title.trim()) {
      inputRef.current?.focus();
      return;
    }
    const input: TodoInput = {
      title: title.trim(),
      categoryId,
      date: defaultDate || todayKey(),
      priority: "MEDIUM",
      repeat: "NONE",
      tags: [],
    };
    setSaving(true);
    setSaveError("");
    try {
      const created = await onAdd(input);
      if (!created) {
        setSaveError("Todo 저장에 실패했습니다. 입력 내용은 유지됩니다.");
        return;
      }
      setTitle("");
      window.requestAnimationFrame(() => titleInputRefFocus());
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Todo 저장 중 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
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
        disabled={saving}
        className={`btn-secondary min-h-9 px-3 py-1.5 ${layout === "stacked" ? "w-full justify-center" : ""}`}
      >
        <Plus size={16} />
        {saving ? "저장 중..." : "추가"}
      </button>
      {saveError ? <p role="alert" className="text-xs font-semibold text-red-200">{saveError}</p> : null}
    </form>
  );
}
