import { FormEvent, useEffect, useId, useRef, useState } from "react";
import { ChevronDown, Plus } from "lucide-react";
import { todayKey } from "../../lib/date";
import { parseQuickTodoTitle } from "../../lib/quickAdd";
import type { Category } from "../../types/category";
import type { Project } from "../../types/project";
import type { Todo, TodoInput, TodoPlanningState, TodoPriority } from "../../types/todo";
import { TodoDetailFields } from "./TodoDetailFields";

const UNSCHEDULED_DATE = "9999-12-31";

type TodoFormProps = {
  onAdd: (todo: TodoInput) => Promise<Todo | undefined> | Todo | undefined;
  defaultDate?: string;
  compact?: boolean;
  submitLabel?: string;
  categories?: Category[];
  projects?: Project[];
  defaultCategoryId?: string;
  defaultProjectId?: string;
  defaultPlanningState?: TodoPlanningState;
  showSyntaxHint?: boolean;
  lockCategory?: boolean;
  collapsible?: boolean;
};

export function TodoForm({
  onAdd,
  defaultDate,
  compact = false,
  submitLabel = "추가",
  categories = [],
  projects = [],
  defaultCategoryId = "",
  defaultProjectId = "",
  defaultPlanningState = "SCHEDULED",
  showSyntaxHint = true,
  lockCategory = false,
  collapsible = false,
}: TodoFormProps) {
  const titleInputRef = useRef<HTMLInputElement | null>(null);
  const detailsId = useId();
  const [title, setTitle] = useState("");
  const [memo, setMemo] = useState("");
  const [date, setDate] = useState(defaultDate || todayKey());
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState<TodoPriority>("MEDIUM");
  const [categoryId, setCategoryId] = useState(defaultCategoryId);
  const [projectId, setProjectId] = useState(defaultProjectId);
  const [planningState, setPlanningState] = useState<TodoPlanningState>(defaultPlanningState);
  const [showDetails, setShowDetails] = useState(!compact);
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState(!collapsible);
  const [saveError, setSaveError] = useState("");

  useEffect(() => { setDate(defaultDate || todayKey()); }, [defaultDate]);
  useEffect(() => { if (collapsible && expanded) titleInputRef.current?.focus(); }, [collapsible, expanded]);
  useEffect(() => { setCategoryId(defaultCategoryId); }, [defaultCategoryId]);
  useEffect(() => { setProjectId(defaultProjectId); }, [defaultProjectId]);
  useEffect(() => { setPlanningState(defaultPlanningState); }, [defaultPlanningState]);

  const reset = () => {
    setTitle("");
    setMemo("");
    setDate(defaultDate || todayKey());
    setDueDate("");
    setPriority("MEDIUM");
    setCategoryId(defaultCategoryId);
    setProjectId(defaultProjectId);
    setPlanningState(defaultPlanningState);
    if (compact) setShowDetails(false);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (saving) return;
    const parsed = parseQuickTodoTitle(title, todayKey(), {
      categories: lockCategory ? [] : categories,
      projects,
    });
    if (!parsed.title) {
      titleInputRef.current?.focus();
      return;
    }

    const nextPlanningState = parsed.planningState ?? planningState;
    const nextDate = parsed.date || date || defaultDate || todayKey();

    const input: TodoInput = {
      title: parsed.title,
      categoryId: lockCategory ? (categoryId || undefined) : ((parsed.categoryId ?? categoryId) || undefined),
      projectId: (parsed.projectId ?? projectId) || undefined,
      memo,
      date: nextPlanningState === "SCHEDULED" ? nextDate : UNSCHEDULED_DATE,
      dueDate: parsed.dueDate || dueDate || undefined,
      planningState: nextPlanningState,
      priority: parsed.priority || priority,
    };
    setSaving(true);
    setSaveError("");
    try {
      const created = await onAdd(input);
      if (!created) {
        setSaveError("Todo 저장에 실패했습니다. 작성 중인 내용은 유지됩니다.");
        return;
      }
      reset();
      if (collapsible) setExpanded(false);
      else window.requestAnimationFrame(() => titleInputRef.current?.focus());
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Todo 저장 중 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  };

  if (collapsible && !expanded) {
    return (
      <button type="button" className="todo-composer-trigger" onClick={() => setExpanded(true)}
        aria-label="할 일 추가" aria-expanded={false} data-todo-composer-trigger="true">
        <Plus size={17} aria-hidden="true" />
        <span>할 일 추가</span>
        <span className="ml-auto text-xs text-ui-muted">클릭하여 입력</span>
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className={`todo-composer-form ${collapsible ? "todo-composer-form--inline" : ""}`}
      aria-label="Todo 빠른 추가"
      onKeyDown={(event) => {
        if (event.key === "Escape" && collapsible && !saving) {
          event.preventDefault();
          setExpanded(false);
        }
      }}>
      <div className="todo-composer-form__main">
        <div className="todo-composer-form__title">
          <input
            ref={titleInputRef}
            data-quick-todo-input="true"
            className="todo-composer-form__input"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="무엇을 할 예정인가요?"
            aria-label="Todo 제목"
          />
        </div>
        {!lockCategory ? (
          <select className="todo-composer-form__category" value={categoryId} onChange={(event) => setCategoryId(event.target.value)} aria-label="카테고리 선택">
            <option value="">미분류</option>
            {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
          </select>
        ) : null}
        <button type="submit" className="btn-primary todo-composer-form__submit" disabled={saving}>
          <Plus size={16} aria-hidden="true" />{saving ? "저장 중..." : submitLabel}
        </button>
      </div>
      {collapsible ? (
        <div className="todo-composer-form__quick-fields" role="group" aria-label="빠른 일정 및 분류">
          <label>
            <span className="sr-only">실행 날짜</span>
            <input type="date" className="field" aria-label="실행 날짜" value={date}
              onChange={(event) => { setDate(event.target.value); setPlanningState("SCHEDULED"); }} disabled={saving || planningState !== "SCHEDULED"} />
          </label>
          <select className="field" aria-label="계획 유형" value={planningState === "SCHEDULED" ? "SCHEDULED" : planningState}
            onChange={(event) => setPlanningState(event.target.value as TodoPlanningState)} disabled={saving}>
            <option value="SCHEDULED">날짜 지정</option>
            <option value="SOMEDAY">언젠가</option>
            <option value="WAITING">대기</option>
          </select>
          <select className="field" aria-label="우선순위" value={priority}
            onChange={(event) => setPriority(event.target.value as TodoPriority)} disabled={saving}>
            <option value="MEDIUM">보통</option>
            <option value="HIGH">높음</option>
            <option value="LOW">낮음</option>
          </select>
          <select className="field" aria-label="프로젝트 선택" value={projectId}
            onChange={(event) => setProjectId(event.target.value)} disabled={saving}>
            <option value="">프로젝트 없음</option>
            {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
          </select>
        </div>
      ) : null}
      {saveError ? <p role="alert" className="mt-2 text-xs font-semibold text-danger">{saveError}</p> : null}
      {showSyntaxHint ? <p className="mt-2 text-[11px] leading-5 text-ui-muted">빠른 문법: 내일 · !high · @프로젝트 · +카테고리 · due:내일 · date:2026-08-20 · someday/waiting · 공백 이름은 @{"{"}프로젝트 이름{"}"} / +{"{"}카테고리 이름{"}"}</p> : null}
      <div className="todo-composer-form__footer">
        {collapsible ? <button type="button" className="todo-composer-form__toggle"
          onClick={() => setExpanded(false)} disabled={saving}>취소 <span className="text-ui-muted">(Esc)</span></button> : null}
        <button
          type="button"
          className="todo-composer-form__toggle"
          onClick={() => setShowDetails((value) => !value)}
          aria-expanded={showDetails}
          aria-controls={detailsId}
        >
          <ChevronDown className={showDetails ? "rotate-180 transition-transform" : "transition-transform"} size={14} aria-hidden="true" />
          {showDetails ? "상세 옵션 닫기" : "상세 옵션"}
        </button>
        {!showDetails && !showSyntaxHint ? <span className="todo-composer-form__hint">Enter로 추가 · 날짜 · 우선순위 · 프로젝트</span> : null}
      </div>
      <div id={detailsId} hidden={!showDetails}>
        {showDetails ? (
          <TodoDetailFields
            date={date}
            dueDate={dueDate}
            priority={priority}
            categoryId={categoryId}
            projectId={projectId}
            planningState={planningState}
            memo={memo}
            categories={categories}
            projects={projects}
            showCategory={false}
            onDateChange={setDate}
            onDueDateChange={setDueDate}
            onPriorityChange={setPriority}
            onCategoryChange={setCategoryId}
            onProjectChange={setProjectId}
            onPlanningStateChange={setPlanningState}
            onMemoChange={setMemo}
          />
        ) : null}
      </div>
    </form>
  );
}
