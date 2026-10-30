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
    <div className="todo-composer-details" role="group" aria-label="Todo 상세 옵션">
      <fieldset className="todo-composer-details__group">
        <legend className="todo-composer-details__legend">일정</legend>
        <div className="todo-composer-details__grid">
          {planningState === "SCHEDULED" ? (
            <label className="todo-composer-details__field">실행일
              <input className="field" type="date" value={date} onChange={(event) => onDateChange(event.target.value)} />
            </label>
          ) : (
            <div className="todo-composer-details__note"><span>실행일 없음</span><p>일정으로 옮길 때 날짜를 지정합니다.</p></div>
          )}
          <label className="todo-composer-details__field">마감일
            <input className="field" type="date" value={dueDate} onChange={(event) => onDueDateChange(event.target.value)} />
          </label>
        </div>
      </fieldset>
      <fieldset className="todo-composer-details__group">
        <legend className="todo-composer-details__legend">분류</legend>
        <div className="todo-composer-details__grid">
          <label className="todo-composer-details__field">보관 위치
            <select className="field" value={planningState} onChange={(event) => onPlanningStateChange(event.target.value as TodoPlanningState)}>
              <option value="SCHEDULED">일정</option><option value="SOMEDAY">언젠가</option><option value="WAITING">대기</option>
            </select>
          </label>
          <label className="todo-composer-details__field">프로젝트
            <select className="field" value={projectId} onChange={(event) => onProjectChange(event.target.value)}>
              <option value="">프로젝트 없음</option>
              {projects.filter((project) => !project.archived).map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
            </select>
          </label>
          <label className="todo-composer-details__field">우선순위
            <select className="field" value={priority} onChange={(event) => onPriorityChange(event.target.value as TodoPriority)}>
              <option value="LOW">낮음</option><option value="MEDIUM">보통</option><option value="HIGH">높음</option>
            </select>
          </label>
          {showCategory ? (
            <label className="todo-composer-details__field">카테고리
              <select className="field" value={categoryId} onChange={(event) => onCategoryChange(event.target.value)}>
                <option value="">미분류</option>
                {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
              </select>
            </label>
          ) : null}
        </div>
      </fieldset>
      <fieldset className="todo-composer-details__group todo-composer-details__group--memo">
        <legend className="todo-composer-details__legend">메모</legend>
        <MarkdownEditor value={memo} onChange={onMemoChange} aria-label="Todo 메모" placeholder="필요한 내용만 간단히 기록하세요" />
      </fieldset>
    </div>
  );
}
