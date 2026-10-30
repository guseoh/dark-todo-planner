import { FormEvent, useEffect, useId, useRef, useState } from "react";
import { CalendarDays, ChevronDown, Flag, FolderKanban, Plus, SlidersHorizontal } from "lucide-react";
import { addDays } from "date-fns";
import { parseDateKey, todayKey, toDateKey } from "../../lib/date";
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
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const dateMenuRef = useRef<HTMLDetailsElement | null>(null);
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
  const [composing, setComposing] = useState(false);
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
    if (saving || composing) return;
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

  const today = todayKey();
  const tomorrow = toDateKey(addDays(parseDateKey(today), 1));
  const dateLabel = planningState === "SOMEDAY" ? "언젠가"
    : planningState === "WAITING" ? "대기"
      : date === today ? "오늘" : date === tomorrow ? "내일"
        : date ? `${Number(date.slice(5, 7))}월 ${Number(date.slice(8, 10))}일` : "날짜 선택";
  const chooseDate = (nextDate: string) => {
    setDate(nextDate);
    setPlanningState("SCHEDULED");
    if (dateMenuRef.current) dateMenuRef.current.open = false;
  };
  const choosePlanning = (next: TodoPlanningState) => {
    setPlanningState(next);
    if (dateMenuRef.current) dateMenuRef.current.open = false;
  };
  const closeComposer = () => {
    setExpanded(false);
    setShowDetails(false);
    if (dateMenuRef.current) dateMenuRef.current.open = false;
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  };

  if (collapsible && !expanded) {
    return (
      <button ref={triggerRef} type="button" className="todo-composer-trigger" onClick={() => setExpanded(true)}
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
        if (event.key === "Enter" && (event.nativeEvent.isComposing || event.keyCode === 229 || composing)) {
          event.preventDefault();
          return;
        }
        if (event.key === "Escape" && collapsible && !saving && !event.nativeEvent.isComposing && !composing) {
          event.preventDefault();
          if (dateMenuRef.current?.open) dateMenuRef.current.open = false;
          else closeComposer();
        }
      }}>
      <div className="todo-composer-form__main">
        <div className="todo-composer-form__title">
          <input
            ref={titleInputRef}
            data-quick-todo-input="true"
            className="todo-composer-form__input"
            value={title}
            onChange={(event) => { setTitle(event.target.value); if (saveError) setSaveError(""); }}
            onCompositionStart={() => setComposing(true)}
            onCompositionEnd={() => setComposing(false)}
            placeholder={collapsible ? "할 일을 입력하세요..." : "무엇을 할 예정인가요?"}
            aria-label="Todo 제목"
          />
        </div>
        {!lockCategory && !collapsible ? (
          <select className="todo-composer-form__category" value={categoryId} onChange={(event) => setCategoryId(event.target.value)} aria-label="카테고리 선택">
            <option value="">미분류</option>
            {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
          </select>
        ) : null}
        {!collapsible ? <button type="submit" className="btn-primary ui-button--primary todo-composer-form__submit" disabled={saving}>
          <Plus size={16} aria-hidden="true" />{saving ? "저장 중..." : submitLabel}
        </button> : null}
      </div>
      {collapsible && !showDetails ? (
        <div className="todo-composer-form__chips" role="group" aria-label="빠른 일정 및 분류">
          <details className="todo-composer-chip-menu" ref={dateMenuRef}>
            <summary className="todo-composer-chip" aria-label="날짜 선택" title="실행 날짜 및 계획 상태 지정">
              <CalendarDays size={14} aria-hidden="true" />
              <span>{dateLabel}</span>
              <ChevronDown size={12} aria-hidden="true" />
            </summary>
            <div className="todo-composer-chip-menu__panel" role="group" aria-label="날짜 빠른 선택">
              <button type="button" onClick={() => chooseDate(today)}>오늘</button>
              <button type="button" onClick={() => chooseDate(tomorrow)}>내일</button>
              <button type="button" onClick={() => chooseDate(toDateKey(addDays(parseDateKey(today), 7)))}>다음 주</button>
              <label className="todo-composer-chip-menu__date">
                <span>직접 지정</span>
                <input type="date" value={date} aria-label="실행 날짜"
                  onChange={(event) => chooseDate(event.target.value || today)} disabled={saving} />
              </label>
              <div className="todo-composer-chip-menu__divider" />
              <button type="button" onClick={() => choosePlanning("SOMEDAY")}>언젠가</button>
              <button type="button" onClick={() => choosePlanning("WAITING")}>대기</button>
            </div>
          </details>
          <label className={`todo-composer-chip todo-composer-chip--select ${priority === "HIGH" ? "todo-composer-chip--urgent" : ""}`}>
            <Flag size={14} aria-hidden="true" />
            <select value={priority} aria-label="우선순위" onChange={(event) => setPriority(event.target.value as TodoPriority)} disabled={saving}>
              <option value="MEDIUM">보통</option>
              <option value="HIGH">높음</option>
              <option value="LOW">낮음</option>
            </select>
            <ChevronDown size={12} aria-hidden="true" />
          </label>
          <label className="todo-composer-chip todo-composer-chip--select todo-composer-chip--project">
            <FolderKanban size={14} aria-hidden="true" />
            <select value={projectId} aria-label="프로젝트 선택" onChange={(event) => setProjectId(event.target.value)} disabled={saving}>
              <option value="">프로젝트</option>
              {projects.filter((project) => !project.archived || project.id === projectId).map((project) =>
                <option key={project.id} value={project.id}>{project.name}</option>)}
            </select>
            <ChevronDown size={12} aria-hidden="true" />
          </label>
        </div>
      ) : null}
      {saveError ? <p role="alert" className="mt-2 text-xs font-semibold text-danger">{saveError}</p> : null}
      {showSyntaxHint ? <p className="mt-2 text-[11px] leading-5 text-ui-muted">빠른 문법: 내일 · !high · @프로젝트 · +카테고리 · due:내일 · date:2026-08-20 · someday/waiting · 공백 이름은 @{"{"}프로젝트 이름{"}"} / +{"{"}카테고리 이름{"}"}</p> : null}
      <div className={`todo-composer-form__footer ${collapsible ? "todo-composer-form__footer--inline" : ""}`}>
        <button type="button" className="todo-composer-form__toggle"
          onClick={() => setShowDetails((value) => !value)} aria-expanded={showDetails} aria-controls={detailsId}>
          {collapsible ? <SlidersHorizontal size={14} aria-hidden="true" /> : <ChevronDown className={showDetails ? "rotate-180 transition-transform" : "transition-transform"} size={14} aria-hidden="true" />}
          {showDetails ? "상세 옵션 닫기" : "상세 옵션"}
        </button>
        {collapsible ? (
          <div className="todo-composer-form__actions">
            <button type="button" className="todo-composer-form__toggle" onClick={closeComposer} disabled={saving}>취소</button>
            <button type="submit" className="btn-primary ui-button--primary todo-composer-form__submit" disabled={saving || !title.trim()}>
              <Plus size={15} aria-hidden="true" />{saving ? "저장 중..." : submitLabel}
            </button>
          </div>
        ) : !showDetails && !showSyntaxHint ? <span className="todo-composer-form__hint">Enter로 추가 · Esc로 닫기</span> : null}
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
            showCategory={collapsible && !lockCategory}
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
