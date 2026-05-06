import { FormEvent, useEffect, useRef, useState } from "react";
import { ChevronDown, Plus } from "lucide-react";
import { todayKey } from "../../lib/date";
import type { Category } from "../../types/category";
import type { TodoInput, TodoPriority, TodoRepeat } from "../../types/todo";
import { TodoDetailFields } from "./TodoDetailFields";

type TodoFormProps = {
  onAdd: (todo: TodoInput) => void;
  defaultDate?: string;
  compact?: boolean;
  submitLabel?: string;
  categories?: Category[];
  defaultCategoryId?: string;
};

export function TodoForm({ onAdd, defaultDate, compact = false, submitLabel = "추가", categories = [], defaultCategoryId = "" }: TodoFormProps) {
  const titleInputRef = useRef<HTMLInputElement | null>(null);
  const [title, setTitle] = useState("");
  const [memo, setMemo] = useState("");
  const [date, setDate] = useState(defaultDate || todayKey());
  const [priority, setPriority] = useState<TodoPriority>("MEDIUM");
  const [repeat, setRepeat] = useState<TodoRepeat>("NONE");
  const [tags, setTags] = useState("");
  const [categoryId, setCategoryId] = useState(defaultCategoryId);
  const [showDetails, setShowDetails] = useState(!compact);

  useEffect(() => {
    setDate(defaultDate || todayKey());
  }, [defaultDate]);

  useEffect(() => {
    setCategoryId(defaultCategoryId);
  }, [defaultCategoryId]);

  const reset = () => {
    setTitle("");
    setMemo("");
    setDate(defaultDate || todayKey());
    setPriority("MEDIUM");
    setRepeat("NONE");
    setTags("");
    setCategoryId(defaultCategoryId);
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
      categoryId: categoryId || undefined,
      memo,
      date: date || todayKey(),
      priority,
      repeat,
      tags: tags.split(","),
    });
    reset();
    window.requestAnimationFrame(() => titleInputRef.current?.focus());
  };

  return (
    <form onSubmit={handleSubmit} className="app-card p-4">
      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(9rem,12rem)_auto] sm:items-center">
        <input
          ref={titleInputRef}
          data-quick-todo-input="true"
          className="field flex-1"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="할 일을 빠르게 입력하세요"
          aria-label="Todo 제목"
        />
        <select
          className="field"
          value={categoryId}
          onChange={(event) => setCategoryId(event.target.value)}
          aria-label="카테고리 선택"
        >
          <option value="">미분류</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
        <div className="flex">
          <button type="submit" className="btn-primary">
            <Plus size={18} />
            {submitLabel}
          </button>
        </div>
      </div>

      <button
        type="button"
        className="mt-2 inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-semibold text-ink-400 transition hover:bg-ink-900/70 hover:text-ink-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/40"
        onClick={() => setShowDetails((value) => !value)}
        aria-expanded={showDetails}
      >
        <ChevronDown className={`transition ${showDetails ? "rotate-180" : ""}`} size={15} />
        상세 옵션
      </button>

      {showDetails ? (
        <TodoDetailFields
          date={date}
          priority={priority}
          categoryId={categoryId}
          repeat={repeat}
          tags={tags}
          memo={memo}
          categories={categories}
          showCategory={false}
          onDateChange={setDate}
          onPriorityChange={setPriority}
          onCategoryChange={setCategoryId}
          onRepeatChange={setRepeat}
          onTagsChange={setTags}
          onMemoChange={setMemo}
        />
      ) : null}
    </form>
  );
}
