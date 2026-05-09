import { ClipboardEvent, FormEvent, useEffect, useState } from "react";
import { ExternalLink, X } from "lucide-react";
import type { Category } from "../../types/category";
import { CATEGORY_ICON_MAX_BYTES, normalizeCategoryIcon } from "../../lib/categoryIcon";
import { CategoryIcon } from "./CategoryIcon";

const colorOptions = ["#6366f1", "#8b5cf6", "#22c55e", "#f59e0b", "#ef4444", "#06b6d4", "#ec4899"];

type CategoryFormProps = {
  category?: Category;
  onSubmit: (input: { name: string; description?: string; color?: string; icon?: string }) => void;
  onCancel: () => void;
  submitLabel?: string;
};

export function CategoryForm({ category, onSubmit, onCancel, submitLabel = "저장" }: CategoryFormProps) {
  const [name, setName] = useState(category?.name || "");
  const [description, setDescription] = useState(category?.description || "");
  const [color, setColor] = useState(category?.color || colorOptions[0]);
  const [icon, setIcon] = useState(category?.icon || "");
  const [iconError, setIconError] = useState("");

  useEffect(() => {
    setName(category?.name || "");
    setDescription(category?.description || "");
    setColor(category?.color || colorOptions[0]);
    setIcon(category?.icon || "");
    setIconError("");
  }, [category]);

  const updateIcon = (value: string) => {
    setIcon(value);
    setIconError(value.trim() && !normalizeCategoryIcon(value) ? "http/https, data:image, emoji 또는 일반 텍스트만 사용할 수 있습니다." : "");
  };

  const handleIconPaste = (event: ClipboardEvent<HTMLInputElement>) => {
    const text = event.clipboardData.getData("text").trim();
    if (text) {
      event.preventDefault();
      updateIcon(text);
      return;
    }

    const imageFile = Array.from(event.clipboardData.files).find((file) => file.type.startsWith("image/"));
    if (!imageFile) return;
    event.preventDefault();
    if (imageFile.size > CATEGORY_ICON_MAX_BYTES) {
      setIconError("이미지 아이콘은 180KB 이하만 붙여넣을 수 있습니다.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => updateIcon(String(reader.result || ""));
    reader.onerror = () => setIconError("이미지 아이콘을 읽지 못했습니다.");
    reader.readAsDataURL(imageFile);
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;
    const normalizedIcon = normalizeCategoryIcon(icon);
    onSubmit({ name: name.trim(), description: description.trim() || undefined, color, icon: normalizedIcon || undefined });
    if (!category) {
      setName("");
      setDescription("");
      setColor(colorOptions[0]);
      setIcon("");
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
      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
        <label className="space-y-1 text-sm text-ink-400">
          아이콘
          <div className="flex gap-2">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-ink-700 bg-ink-950/70">
              <CategoryIcon icon={icon} color={color} name={name || "카테고리"} className="h-8 w-8" />
            </div>
            <input
              className="field min-w-0 flex-1"
              value={icon}
              onChange={(event) => updateIcon(event.target.value)}
              onPaste={handleIconPaste}
              placeholder="✅ 또는 이미지 URL 붙여넣기"
              aria-label="카테고리 아이콘"
            />
            {icon ? (
              <button type="button" className="icon-btn h-11 w-11" onClick={() => updateIcon("")} aria-label="아이콘 제거">
                <X size={16} />
              </button>
            ) : null}
          </div>
          <span className="block text-xs text-ink-500">Noticon에서 복사한 이모지, 아이콘, 이미지 주소를 붙여넣을 수 있습니다.</span>
          {iconError ? <span className="block text-xs text-red-200">{iconError}</span> : null}
        </label>
        <a
          className="btn-secondary min-h-10 justify-center px-3 py-2 text-sm"
          href="https://noticon.tammolo.com/"
          target="_blank"
          rel="noopener noreferrer"
        >
          <ExternalLink size={15} />
          Noticon 열기
        </a>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
        <button type="button" className="btn-secondary" onClick={onCancel}>
          취소
        </button>
        <button type="submit" className="btn-primary" disabled={!name.trim() || Boolean(iconError)}>
          {submitLabel}
        </button>
      </div>
    </form>
  );
}
