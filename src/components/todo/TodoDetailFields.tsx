import type { Category } from "../../types/category";
import type { Project } from "../../types/project";
import type { TodoPlanningState, TodoPriority } from "../../types/todo";
import { MarkdownEditor } from "../editor/MarkdownEditor";

type TodoDetailFieldsProps = {
  date: string;
  dueDate: string;
  priority: TodoPriority;
  categoryId: string;
  projectId: string;
  planningState: TodoPlanningState;
  memo: string;
  categories: Category[];
  projects?: Project[];
  showCategory?: boolean;
  onDateChange: (value: string) => void;
  onDueDateChange: (value: string) => void;
  onPriorityChange: (value: TodoPriority) => void;
  onCategoryChange: (value: string) => void;
  onProjectChange: (value: string) => void;
  onPlanningStateChange: (value: TodoPlanningState) => void;
  onMemoChange: (value: string) => void;
};

export function TodoDetailFields({
  date,
  dueDate,
  priority,
  categoryId,
  projectId,
  planningState,
  memo,
  categories,
  projects = [],
  showCategory = true,
  onDateChange,
  onDueDateChange,
  onPriorityChange,
  onCategoryChange,
  onProjectChange,
  onPlanningStateChange,
  onMemoChange,
}: TodoDetailFieldsProps) {
  return (
    <div className="mt-3 grid gap-3">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <label className="space-y-1 text-xs font-semibold text-ink-400">
          보관 위치
          <select className="field h-10 min-h-10 py-1.5" value={planningState} onChange={(event) => onPlanningStateChange(event.target.value as TodoPlanningState)}>
            <option value="SCHEDULED">일정</option><option value="INBOX">Inbox</option><option value="SOMEDAY">Someday</option><option value="WAITING">Waiting</option>
          </select>
        </label>
        {planningState === "SCHEDULED" ? (
          <label className="space-y-1 text-xs font-semibold text-ink-400">실행일<input className="field h-10 min-h-10 py-1.5" type="date" value={date} onChange={(event) => onDateChange(event.target.value)} /></label>
        ) : (
          <div className="rounded-lg border border-ink-700/60 bg-ink-950/35 px-3 py-2 text-xs text-ink-500"><span className="font-semibold text-ink-400">실행일 없음</span><p className="mt-1">일정으로 옮길 때 날짜를 정합니다.</p></div>
        )}
        <label className="space-y-1 text-xs font-semibold text-ink-400">마감일<input className="field h-10 min-h-10 py-1.5" type="date" value={dueDate} onChange={(event) => onDueDateChange(event.target.value)} /></label>
        <label className="space-y-1 text-xs font-semibold text-ink-400">프로젝트
          <select className="field h-10 min-h-10 py-1.5" value={projectId} onChange={(event) => onProjectChange(event.target.value)}><option value="">프로젝트 없음</option>{projects.filter((project) => !project.archived).map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select>
        </label>
        <label className="space-y-1 text-xs font-semibold text-ink-400">우선순위<select className="field h-10 min-h-10 py-1.5" value={priority} onChange={(event) => onPriorityChange(event.target.value as TodoPriority)}><option value="LOW">낮음</option><option value="MEDIUM">보통</option><option value="HIGH">높음</option></select></label>
        {showCategory ? <label className="space-y-1 text-xs font-semibold text-ink-400">카테고리<select className="field h-10 min-h-10 py-1.5" value={categoryId} onChange={(event) => onCategoryChange(event.target.value)}><option value="">미분류</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label> : null}
      </div>
      <MarkdownEditor label="메모" value={memo} onChange={onMemoChange} placeholder="간단한 메모를 남겨두세요" />
    </div>
  );
}
