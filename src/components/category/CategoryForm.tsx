import { FormEvent, useEffect, useState } from "react";
import type { Category } from "../../types/category";
import { normalizeCategoryIcon } from "../../lib/categoryIcon";
import { IconPicker } from "../common/IconPicker";
import { IconRenderer } from "../common/IconRenderer";

const colorOptions = ["#6366f1", "#8b5cf6", "#22c55e", "#f59e0b", "#ef4444", "#06b6d4", "#ec4899"];

type CategoryFormProps = {
  category?: Category;
  onSubmit: (input: { name: string; description?: string; color?: string; icon?: string }) => void | Promise<void>;
  onCancel: () => void;
  submitLabel?: string;
};

export function CategoryForm({ category, onSubmit, onCancel, submitLabel = "저장" }: CategoryFormProps) {
  const [name, setName] = useState(category?.name || "");
  const [description, setDescription] = useState(category?.description || "");
  const [color, setColor] = useState(category?.color || colorOptions[0]);
  const [icon, setIcon] = useState(category?.icon || "");
  const [iconError, setIconError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setName(category?.name || "");
    setDescription(category?.description || "");
    setColor(category?.color || colorOptions[0]);
    setIcon(category?.icon || "");
    setIconError("");
  }, [category]);

  const updateIcon = (value: string) => {
    setIcon(value);
    setIconError(value.trim() && !normalizeCategoryIcon(value) ? "http/https, data:image, lucide 아이콘, emoji만 사용할 수 있습니다." : "");
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim() || iconError) return;
    setSaving(true);
    try {
      const normalizedIcon = normalizeCategoryIcon(icon);
      await onSubmit({ name: name.trim(), description: description.trim() || undefined, color, icon: normalizedIcon || undefined });
      if (!category) {
        setName("");
        setDescription("");
        setColor(colorOptions[0]);
        setIcon("");
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4">
        <label className="space-y-1 text-sm text-ink-400">
          카테고리 이름
          <input className="field" value={name} onChange={(event) => setName(event.target.value)} placeholder="예: JPA 책" />
        </label>
        <label className="space-y-1 text-sm text-ink-400">
          설명
          <input className="field" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="선택 입력" />
        </label>
      </div>

      <div className="space-y-2 rounded-lg border border-ink-700 bg-ink-950/35 p-3">
        <p className="text-sm font-semibold text-ink-300">색상</p>
        <div className="flex flex-wrap gap-2">
          {colorOptions.map((option) => (
            <button
              key={option}
              type="button"
              className={`h-8 w-8 rounded-full border border-white/20 transition ${
                color === option ? "ring-2 ring-accent-300 ring-offset-2 ring-offset-ink-950" : "hover:scale-105"
              }`}
              style={{ backgroundColor: option }}
              onClick={() => setColor(option)}
              aria-label={`${option} 색상 선택`}
            />
          ))}
        </div>
      </div>

      <div className="space-y-2 rounded-lg border border-ink-700 bg-ink-950/35 p-3">
        <p className="text-sm font-semibold text-ink-300">아이콘</p>
        <IconPicker value={icon} onChange={updateIcon} color={color} name={name || "카테고리"} />
        {iconError ? <span className="block text-xs text-red-200">{iconError}</span> : null}
      </div>

      <div className="rounded-lg border border-ink-700 bg-ink-950/45 p-3">
        <p className="mb-2 text-xs font-semibold text-ink-500">미리보기</p>
        <div className="flex min-w-0 items-center gap-3">
          <IconRenderer icon={icon} color={color} name={name || "카테고리"} className={icon ? "h-9 w-9" : "h-3 w-3"} fallback="box" />
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-ink-100">{name || "카테고리 이름"}</p>
            <p className="truncate text-xs text-ink-500">{description || "설명 없음"}</p>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2 border-t border-ink-700 pt-4 sm:flex-row sm:justify-end">
        <button type="button" className="btn-secondary" onClick={onCancel}>
          취소
        </button>
        <button type="submit" className="btn-primary" disabled={!name.trim() || Boolean(iconError) || saving}>
          {saving ? "저장 중" : submitLabel}
        </button>
      </div>
    </form>
  );
}
