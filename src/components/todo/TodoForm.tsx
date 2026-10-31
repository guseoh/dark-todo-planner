import { FormEvent, useEffect, useId, useRef, useState } from "react";
import type { ReactNode, RefObject } from "react";
import { CalendarDays, Check, ChevronDown, Flag, FolderKanban, Plus, SlidersHorizontal, Tags } from "lucide-react";
import { addDays } from "date-fns";
import { parseDateKey, todayKey, toDateKey } from "../../lib/date";
import { parseQuickTodoTitle } from "../../lib/quickAdd";
import type { Category } from "../../types/category";
import type { Project } from "../../types/project";
import type { Todo, TodoInput, TodoPlanningState, TodoPriority } from "../../types/todo";
import { TodoDetailFields } from "./TodoDetailFields";

const UNSCHEDULED_DATE = "9999-12-31";

type InlineMenuOption = { value: string; label: string };

function InlineSelectMenu({
  label, value, options, icon, menuRef, className = "", disabled = false, onOpen, onChange,
}: {
  label: string;
  value: string;
  options: InlineMenuOption[];
  icon: ReactNode;
  menuRef: RefObject<HTMLDetailsElement>;
  className?: string;
  disabled?: boolean;
  onOpen: (current: HTMLDetailsElement | null) => void;
  onChange: (value: string) => void;
}) {
  const currentLabel = value ? (options.find((option) => option.value === value)?.label ?? label)
    : (label === "카테고리" ? "카테고리" : (options[0]?.label ?? label));

  return (
    <details ref={menuRef} className={`todo-composer-chip-menu todo-composer-chip-menu--select ${className}`}
      data-composer-selection={label} data-selected-value={value}>
      <summary className="todo-composer-chip" aria-label={`${label} 선택`}
        aria-disabled={disabled} title={`${label}: ${currentLabel}`}
        onClick={(event) => {
          if (disabled) { event.preventDefault(); return; }
          onOpen(menuRef.current);
        }}>
        {icon}
        <span className="todo-composer-chip__value" title={currentLabel}>{currentLabel}</span>
        <ChevronDown size={12} className="todo-composer-chip__chevron" aria-hidden="true" />
      </summary>
      <div className="todo-composer-chip-menu__panel todo-composer-chip-menu__panel--options"
        role="group" aria-label={`${label} 선택 항목`}>
        {options.map((option) => (
          <button key={option.value} type="button"
            className="todo-composer-chip-menu__option"
            aria-pressed={option.value === value} disabled={disabled}
            onClick={() => {
              onChange(option.value);
              if (menuRef.current) {
                menuRef.current.open = false;
                menuRef.current.querySelector("summary")?.focus();
              }
            }}>
            <span className="todo-composer-chip-menu__option-label">{option.label}</span>
            <Check size={13} aria-hidden="true"
              className={option.value === value ? "todo-composer-chip-menu__check--visible" : "todo-composer-chip-menu__check"} />
          </button>
        ))}
      </div>
    </details>
  );
}


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
  const priorityMenuRef = useRef<HTMLDetailsElement | null>(null);
  const projectMenuRef = useRef<HTMLDetailsElement | null>(null);
  const categoryMenuRef = useRef<HTMLDetailsElement | null>(null);
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
  useEffect(() => {
    if (!collapsible || !expanded) return;
    const handleOutsidePointer = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      const menus = [dateMenuRef, priorityMenuRef, projectMenuRef, categoryMenuRef];
      if (menus.some((menu) => menu.current?.open) && !menus.some((menu) => menu.current?.contains(target))) {
        menus.forEach((menu) => { if (menu.current) menu.current.open = false; });
      }
    };
    document.addEventListener("pointerdown", handleOutsidePointer);
    return () => document.removeEventListener("pointerdown", handleOutsidePointer);
  }, [collapsible, expanded]);

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
  const closeMenus = (except?: HTMLDetailsElement | null) => {
    [dateMenuRef, priorityMenuRef, projectMenuRef, categoryMenuRef].forEach((menu) => {
      if (menu.current && menu.current !== except) menu.current.open = false;
    });
  };
  const chooseDate = (nextDate: string) => {
    setDate(nextDate);
    setPlanningState("SCHEDULED");
    closeMenus();
  };
  const choosePlanning = (next: TodoPlanningState) => {
    setPlanningState(next);
    closeMenus();
  };
  const closeComposer = () => {
    setExpanded(false);
    setShowDetails(false);
    closeMenus();
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  };

  if (collapsible && !expanded) {
    return (
      <button ref={triggerRef} type="button" className="todo-composer-trigger" onClick={() => setExpanded(true)}
        aria-label="할 일 추가" aria-expanded={false} data-todo-composer-trigger="true">
        <Plus size={17} aria-hidden="true" />
        <span>할 일 추가</span>
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
          if ([dateMenuRef, priorityMenuRef, projectMenuRef, categoryMenuRef].some((menu) => menu.current?.open)) closeMenus();
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
            placeholder={collapsible ? "할 일 이름" : "무엇을 할 예정인가요?"}
            aria-label="Todo 제목"
          />
        </div>
        {collapsible ? (
          <button type="submit" className="todo-composer-form__submit todo-composer-form__submit--quiet"
            disabled={saving || composing || !title.trim()} aria-label={submitLabel}>
            {saving ? "저장 중..." : submitLabel}
          </button>
        ) : null}
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
      <div className={collapsible ? "todo-composer-form__meta-row" : "todo-composer-form__meta-row--standard"}>
      {collapsible && !showDetails ? (
        <div className="todo-composer-form__chips" role="group" aria-label="빠른 일정 및 분류">
          <details className="todo-composer-chip-menu todo-composer-chip-menu--date" ref={dateMenuRef}>
            <summary className="todo-composer-chip" aria-label="날짜 선택" title="실행 날짜 및 계획 상태 지정" onClick={() => closeMenus(dateMenuRef.current)}>
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
          <InlineSelectMenu label="우선순위" value={priority} menuRef={priorityMenuRef}
            icon={<Flag size={14} aria-hidden="true" />}
            className={priority === "HIGH" ? "todo-composer-chip-menu--urgent" : ""}
            options={[{ value: "LOW", label: "낮음" }, { value: "MEDIUM", label: "보통" }, { value: "HIGH", label: "높음" }]}
            disabled={saving} onOpen={closeMenus} onChange={(value) => setPriority(value as TodoPriority)} />
          <InlineSelectMenu label="프로젝트" value={projectId} menuRef={projectMenuRef}
            icon={<FolderKanban size={14} aria-hidden="true" />} className="todo-composer-chip-menu--project"
            options={[{ value: "", label: "프로젝트" }, ...projects
              .filter((project) => !project.archived || project.id === projectId)
              .map((project) => ({ value: project.id, label: project.name }))]}
            disabled={saving} onOpen={closeMenus} onChange={setProjectId} />
          <InlineSelectMenu label="카테고리" value={categoryId} menuRef={categoryMenuRef}
            icon={<Tags size={14} aria-hidden="true" />} className="todo-composer-chip-menu--category"
            options={[{ value: "", label: "미분류" }, ...categories.map((category) => ({
              value: category.id, label: category.name,
            }))]}
            disabled={saving || lockCategory} onOpen={closeMenus} onChange={setCategoryId} />
        </div>
      ) : null}
      <div className={`todo-composer-form__footer ${collapsible ? "todo-composer-form__footer--inline" : ""}`}>
        <button type="button" className="todo-composer-form__toggle"
          onClick={() => { closeMenus(); setShowDetails((value) => !value); }} aria-expanded={showDetails} aria-controls={detailsId}>
          {collapsible ? <SlidersHorizontal size={14} aria-hidden="true" /> : <ChevronDown className={showDetails ? "rotate-180 transition-transform" : "transition-transform"} size={14} aria-hidden="true" />}
          {showDetails ? "상세 옵션 닫기" : "상세 옵션"}
        </button>
        {collapsible ? (
          <div className="todo-composer-form__actions">
            <button type="button" className="todo-composer-form__toggle todo-composer-form__cancel" onClick={closeComposer} disabled={saving}>취소</button>
          </div>
        ) : !showDetails && !showSyntaxHint ? <span className="todo-composer-form__hint">Enter로 추가 · Esc로 닫기</span> : null}
      </div>
      </div>
      {saveError ? <p role="alert" className="mt-2 text-xs font-semibold text-danger">{saveError}</p> : null}
      {showSyntaxHint ? <p className="mt-2 text-[11px] leading-5 text-ui-muted">빠른 문법: 내일 · !high · @프로젝트 · +카테고리 · due:내일 · date:2026-08-20 · someday/waiting · 공백 이름은 @{"{"}프로젝트 이름{"}"} / +{"{"}카테고리 이름{"}"}</p> : null}
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
