import type { Category } from "../../types/category";
import type { TodoPriority, TodoRepeat } from "../../types/todo";

type TodoDetailFieldsProps = {
  date: string;
  priority: TodoPriority;
  categoryId: string;
  repeat: TodoRepeat;
  tags: string;
  memo: string;
  categories: Category[];
  showCategory?: boolean;
  onDateChange: (value: string) => void;
  onPriorityChange: (value: TodoPriority) => void;
  onCategoryChange: (value: string) => void;
  onRepeatChange: (value: TodoRepeat) => void;
  onTagsChange: (value: string) => void;
  onMemoChange: (value: string) => void;
};

export function TodoDetailFields({
  date,
  priority,
  categoryId,
  repeat,
  tags,
  memo,
  categories,
  showCategory = true,
  onDateChange,
  onPriorityChange,
  onCategoryChange,
  onRepeatChange,
  onTagsChange,
  onMemoChange,
}: TodoDetailFieldsProps) {
  return (
    <div className="mt-3 grid gap-3">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <label className="space-y-1 text-xs font-semibold text-ink-400">
          날짜
          <input className="field h-10 min-h-10 py-1.5" type="date" value={date} onChange={(event) => onDateChange(event.target.value)} />
        </label>
        <label className="space-y-1 text-xs font-semibold text-ink-400">
          우선순위
          <select className="field h-10 min-h-10 py-1.5" value={priority} onChange={(event) => onPriorityChange(event.target.value as TodoPriority)}>
            <option value="LOW">낮음</option>
            <option value="MEDIUM">보통</option>
            <option value="HIGH">높음</option>
          </select>
        </label>
        {showCategory ? (
          <label className="space-y-1 text-xs font-semibold text-ink-400">
            카테고리
            <select className="field h-10 min-h-10 py-1.5" value={categoryId} onChange={(event) => onCategoryChange(event.target.value)}>
              <option value="">미분류</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <label className="space-y-1 text-xs font-semibold text-ink-400">
          반복
          <select className="field h-10 min-h-10 py-1.5" value={repeat} onChange={(event) => onRepeatChange(event.target.value as TodoRepeat)}>
            <option value="NONE">반복 없음</option>
            <option value="DAILY">매일</option>
            <option value="WEEKLY">매주</option>
            <option value="MONTHLY">매월</option>
            <option value="WEEKDAY">평일만</option>
            <option value="WEEKEND">주말만</option>
          </select>
        </label>
      </div>

      <label className="space-y-1 text-xs font-semibold text-ink-400">
        태그
        <input className="field h-10 min-h-10 py-1.5" value={tags} onChange={(event) => onTagsChange(event.target.value)} placeholder="공부, 개발, 운동" />
      </label>

      <label className="space-y-1 text-xs font-semibold text-ink-400">
        메모
        <textarea
          className="field min-h-20 resize-y"
          value={memo}
          onChange={(event) => onMemoChange(event.target.value)}
          placeholder="간단한 메모를 남겨두세요"
        />
      </label>
    </div>
  );
}
