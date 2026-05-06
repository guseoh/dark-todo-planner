import { FormEvent, useEffect, useState } from "react";
import type { Category } from "../../types/category";

const colorOptions = ["#6366f1", "#8b5cf6", "#22c55e", "#f59e0b", "#ef4444", "#06b6d4", "#ec4899"];

type CategoryFormProps = {
  category?: Category;
  onSubmit: (input: { name: string; description?: string; color?: string }) => void;
  onCancel: () => void;
  submitLabel?: string;
};

export function CategoryForm({ category, onSubmit, onCancel, submitLabel = "저장" }: CategoryFormProps) {
  const [name, setName] = useState(category?.name || "");
  const [description, setDescription] = useState(category?.description || "");
  const [color, setColor] = useState(category?.color || colorOptions[0]);

  useEffect(() => {
    setName(category?.name || "");
    setDescription(category?.description || "");
    setColor(category?.color || colorOptions[0]);
  }, [category]);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;
    onSubmit({ name: name.trim(), description: description.trim() || undefined, color });
    if (!category) {
      setName("");
      setDescription("");
      setColor(colorOptions[0]);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="app-card space-y-3 p-4">
      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
        <label className="space-y-1 text-sm text-ink-400">
          카테고리 이름
          <input className="field" value={name} onChange={(event) => setName(event.target.value)} placeholder="예: JPA 책" />
        </label>
        <label className="space-y-1 text-sm text-ink-400">
          설명
          <input className="field" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="선택 입력" />
        </label>
        <label className="space-y-1 text-sm text-ink-400">
          색상
          <div className="flex min-h-11 items-center gap-2 rounded-lg border border-ink-700 bg-ink-950/70 px-3">
            {colorOptions.map((option) => (
              <button
                key={option}
                type="button"
                className={`h-5 w-5 rounded-full border transition ${color === option ? "border-white ring-2 ring-accent-400/60" : "border-ink-600"}`}
                style={{ backgroundColor: option }}
                onClick={() => setColor(option)}
                aria-label={`${option} 색상 선택`}
              />
            ))}
          </div>
        </label>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
        <button type="button" className="btn-secondary" onClick={onCancel}>
          취소
        </button>
        <button type="submit" className="btn-primary" disabled={!name.trim()}>
          {submitLabel}
        </button>
      </div>
    </form>
  );
}
