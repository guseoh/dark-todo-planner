import type { Category } from "../../types/category";
import type { Project } from "../../types/project";
import type { TodoPlanningState, TodoPriority, TodoRepeat } from "../../types/todo";
import { MarkdownEditor } from "../editor/MarkdownEditor";

type TodoDetailFieldsProps = {
  date: string; dueDate: string; priority: TodoPriority; categoryId: string; projectId: string; planningState: TodoPlanningState; estimateMinutes: string;
  repeat: TodoRepeat; tags: string; memo: string; categories: Category[]; projects?: Project[]; showCategory?: boolean;
  onDateChange: (value: string) => void; onDueDateChange: (value: string) => void; onPriorityChange: (value: TodoPriority) => void; onCategoryChange: (value: string) => void;
  onProjectChange: (value: string) => void; onPlanningStateChange: (value: TodoPlanningState) => void; onEstimateMinutesChange: (value: string) => void;
  onRepeatChange: (value: TodoRepeat) => void; onTagsChange: (value: string) => void; onMemoChange: (value: string) => void;
};

export function TodoDetailFields({
  date, dueDate, priority, categoryId, projectId, planningState, estimateMinutes, repeat, tags, memo, categories, projects = [], showCategory = true,
  onDateChange, onDueDateChange, onPriorityChange, onCategoryChange, onProjectChange, onPlanningStateChange, onEstimateMinutesChange, onRepeatChange, onTagsChange, onMemoChange,
}: TodoDetailFieldsProps) {
  return (
    <div className="mt-3 grid gap-3">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
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
        <label className="space-y-1 text-xs font-semibold text-ink-400">예상 시간(분)<input className="field h-10 min-h-10 py-1.5" type="number" min="1" max="1440" value={estimateMinutes} onChange={(event) => onEstimateMinutesChange(event.target.value)} placeholder="30" /></label>
        <label className="space-y-1 text-xs font-semibold text-ink-400">프로젝트
          <select className="field h-10 min-h-10 py-1.5" value={projectId} onChange={(event) => onProjectChange(event.target.value)}><option value="">프로젝트 없음</option>{projects.filter((project) => !project.archived).map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select>
        </label>
        <label className="space-y-1 text-xs font-semibold text-ink-400">우선순위<select className="field h-10 min-h-10 py-1.5" value={priority} onChange={(event) => onPriorityChange(event.target.value as TodoPriority)}><option value="LOW">낮음</option><option value="MEDIUM">보통</option><option value="HIGH">높음</option></select></label>
        {showCategory ? <label className="space-y-1 text-xs font-semibold text-ink-400">카테고리<select className="field h-10 min-h-10 py-1.5" value={categoryId} onChange={(event) => onCategoryChange(event.target.value)}><option value="">미분류</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label> : null}
        <label className="space-y-1 text-xs font-semibold text-ink-400">반복<select className="field h-10 min-h-10 py-1.5" value={repeat} onChange={(event) => onRepeatChange(event.target.value as TodoRepeat)}><option value="NONE">반복 없음</option><option value="DAILY">매일</option><option value="WEEKLY">매주</option><option value="MONTHLY">매월</option><option value="WEEKDAY">평일만</option><option value="WEEKEND">주말만</option></select></label>
      </div>
      <label className="space-y-1 text-xs font-semibold text-ink-400">태그<input className="field h-10 min-h-10 py-1.5" value={tags} onChange={(event) => onTagsChange(event.target.value)} placeholder="공부, 개발, 운동" /></label>
      <MarkdownEditor label="메모" value={memo} onChange={onMemoChange} placeholder="간단한 메모를 남겨두세요" />
    </div>
  );
}
