import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp, Pencil, Plus, Trash2 } from "lucide-react";
import type { Category } from "../../types/category";
import { CategoryForm } from "../category/CategoryForm";
import { EmptyState } from "../common/EmptyState";
import { IconRenderer } from "../common/IconRenderer";
import { Modal } from "../common/Modal";

type CategoryInput = { name: string; description?: string; color?: string; icon?: string };

type TodayCategoryManagerProps = {
  open: boolean;
  categories: Category[];
  categoryCounts: ReadonlyMap<string, number>;
  onClose: () => void;
  onAddCategory: (input: CategoryInput) => void | Promise<void>;
  onUpdateCategory: (id: string, input: Partial<Category>) => void | Promise<void>;
  onDeleteCategory: (id: string, mode: "moveTodos" | "deleteTodos") => void | Promise<void>;
  onReorderCategories: (ids: string[]) => void | Promise<void>;
  onCategoryDeleted: (id: string) => void;
};

const getMessage = (error: unknown, fallback: string) => error instanceof Error ? error.message : fallback;

export function TodayCategoryManager({
  open,
  categories,
  categoryCounts,
  onClose,
  onAddCategory,
  onUpdateCategory,
  onDeleteCategory,
  onReorderCategories,
  onCategoryDeleted,
}: TodayCategoryManagerProps) {
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) return;
    setCreating(false);
    setEditing(null);
    setError("");
  }, [open]);

  if (!open) return null;

  const moveCategory = async (categoryId: string, direction: -1 | 1) => {
    const ids = categories.map((category) => category.id);
    const currentIndex = ids.indexOf(categoryId);
    const targetIndex = currentIndex + direction;
    if (currentIndex < 0 || targetIndex < 0 || targetIndex >= ids.length) return;

    [ids[currentIndex], ids[targetIndex]] = [ids[targetIndex], ids[currentIndex]];
    try {
      setError("");
      await onReorderCategories(ids);
    } catch (cause) {
      setError(getMessage(cause, "카테고리 순서를 저장하지 못했습니다."));
    }
  };

  const createCategory = async (input: CategoryInput) => {
    try {
      setError("");
      await onAddCategory(input);
      setCreating(false);
    } catch (cause) {
      setError(getMessage(cause, "카테고리를 저장하지 못했습니다."));
    }
  };

  const updateCategory = async (input: CategoryInput) => {
    if (!editing) return;
    try {
      setError("");
      await onUpdateCategory(editing.id, input);
      setEditing(null);
    } catch (cause) {
      setError(getMessage(cause, "카테고리를 저장하지 못했습니다."));
    }
  };

  const deleteCategory = async (category: Category) => {
    if (!window.confirm(`"${category.name}" 카테고리를 삭제할까요?`)) return;
    const deleteTodos = window.confirm(
      "하위 Todo도 함께 삭제할까요?\n\n확인: 카테고리와 Todo 함께 삭제\n취소: Todo는 미분류로 이동",
    );

    try {
      setError("");
      await onDeleteCategory(category.id, deleteTodos ? "deleteTodos" : "moveTodos");
      onCategoryDeleted(category.id);
    } catch (cause) {
      setError(getMessage(cause, "카테고리를 삭제하지 못했습니다."));
    }
  };

  return (
    <>
      <Modal
        title="카테고리 관리"
        description="오늘 화면에서는 비어 있는 카테고리를 숨기고, 추가·수정·삭제·순서 변경은 이곳에서 관리합니다."
        onClose={onClose}
        size="lg"
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-ink-400">전체 {categories.length}개 카테고리</p>
            <button type="button" className="btn-primary" onClick={() => setCreating(true)}>
              <Plus size={16} />카테고리 추가
            </button>
          </div>

          {error ? <p className="rounded-lg border border-danger/40 bg-danger/[0.08] px-3 py-2 text-sm text-red-100" role="alert">{error}</p> : null}

          {categories.length ? (
            <div className="space-y-2">
              {categories.map((category, index) => (
                <div key={category.id} className="flex items-center gap-3 rounded-lg border border-ink-800/70 bg-ink-950/30 px-3 py-2.5">
                  <IconRenderer
                    icon={category.icon}
                    color={category.color || "#0b72d7"}
                    name={category.name}
                    className={category.icon ? "h-8 w-8" : "h-3 w-3"}
                    fallback="dot"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-ink-100">{category.name}</p>
                    <p className="mt-0.5 truncate text-xs text-ink-400">오늘 {categoryCounts.get(category.id) || 0}개{category.description ? ` · ${category.description}` : ""}</p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button type="button" className="icon-btn h-9 w-9 rounded-md" onClick={() => void moveCategory(category.id, -1)} disabled={index === 0} aria-label={`${category.name} 위로 이동`} title="위로 이동"><ChevronUp size={14} /></button>
                    <button type="button" className="icon-btn h-9 w-9 rounded-md" onClick={() => void moveCategory(category.id, 1)} disabled={index === categories.length - 1} aria-label={`${category.name} 아래로 이동`} title="아래로 이동"><ChevronDown size={14} /></button>
                    <button type="button" className="icon-btn h-9 w-9 rounded-md" onClick={() => setEditing(category)} aria-label={`${category.name} 수정`} title="수정"><Pencil size={14} /></button>
                    <button type="button" className="icon-btn h-9 w-9 rounded-md hover:border-danger hover:text-red-100" onClick={() => void deleteCategory(category)} aria-label={`${category.name} 삭제`} title="삭제"><Trash2 size={14} /></button>
                  </div>
                </div>
              ))}
            </div>
          ) : <EmptyState title="카테고리가 없습니다." description="필요할 때만 카테고리를 추가해 Todo를 묶어보세요." />}
        </div>
      </Modal>

      {creating ? (
        <Modal title="새 카테고리 추가" description="Todo를 묶을 카테고리 이름, 색상, 아이콘을 설정합니다." onClose={() => setCreating(false)}>
          <CategoryForm onSubmit={createCategory} onCancel={() => setCreating(false)} submitLabel="카테고리 추가" />
        </Modal>
      ) : null}

      {editing ? (
        <Modal title="카테고리 수정" description="이름, 설명, 색상과 아이콘을 수정합니다." onClose={() => setEditing(null)}>
          <CategoryForm category={editing} onSubmit={updateCategory} onCancel={() => setEditing(null)} submitLabel="변경 저장" />
        </Modal>
      ) : null}
    </>
  );
}
