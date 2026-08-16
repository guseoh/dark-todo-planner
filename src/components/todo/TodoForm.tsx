import { FormEvent, useEffect, useRef, useState } from "react";
import { ChevronDown, Plus } from "lucide-react";
import { todayKey } from "../../lib/date";
import { parseQuickTodoTitle } from "../../lib/quickAdd";
import type { Category } from "../../types/category";
import type { Project } from "../../types/project";
import type { TodoInput, TodoPlanningState, TodoPriority, TodoRepeat } from "../../types/todo";
import { TodoDetailFields } from "./TodoDetailFields";

const UNSCHEDULED_DATE = "9999-12-31";

type TodoFormProps = {
  onAdd: (todo: TodoInput) => void;
  defaultDate?: string;
  compact?: boolean;
  submitLabel?: string;
  categories?: Category[];
  projects?: Project[];
  defaultCategoryId?: string;
  defaultProjectId?: string;
  defaultPlanningState?: TodoPlanningState;
  showSyntaxHint?: boolean;
};

export function TodoForm({
  onAdd, defaultDate, compact = false, submitLabel = "추가", categories = [], projects = [], defaultCategoryId = "", defaultProjectId = "", defaultPlanningState = "SCHEDULED", showSyntaxHint = true,
}: TodoFormProps) {
  const titleInputRef = useRef<HTMLInputElement | null>(null);
  const [title, setTitle] = useState("");
  const [memo, setMemo] = useState("");
  const [date, setDate] = useState(defaultDate || todayKey());
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState<TodoPriority>("MEDIUM");
  const [repeat, setRepeat] = useState<TodoRepeat>("NONE");
  const [tags, setTags] = useState("");
  const [categoryId, setCategoryId] = useState(defaultCategoryId);
  const [projectId, setProjectId] = useState(defaultProjectId);
  const [planningState, setPlanningState] = useState<TodoPlanningState>(defaultPlanningState);
  const [estimateMinutes, setEstimateMinutes] = useState("");
  const [showDetails, setShowDetails] = useState(!compact);

  useEffect(() => { setDate(defaultDate || todayKey()); }, [defaultDate]);
  useEffect(() => { setCategoryId(defaultCategoryId); }, [defaultCategoryId]);
  useEffect(() => { setProjectId(defaultProjectId); }, [defaultProjectId]);
  useEffect(() => { setPlanningState(defaultPlanningState); }, [defaultPlanningState]);

  const reset = () => {
    setTitle(""); setMemo(""); setDate(defaultDate || todayKey()); setDueDate(""); setPriority("MEDIUM"); setRepeat("NONE"); setTags("");
    setCategoryId(defaultCategoryId); setProjectId(defaultProjectId); setPlanningState(defaultPlanningState); setEstimateMinutes("");
    if (compact) setShowDetails(false);
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const parsed = parseQuickTodoTitle(title, todayKey(), { categories, projects });
    if (!parsed.title) { titleInputRef.current?.focus(); return; }

    const nextPlanningState = parsed.planningState ?? planningState;
    const nextDate = parsed.date || date || defaultDate || todayKey();
    const mergedTags = Array.from(new Set([
      ...tags.split(",").map((tag) => tag.trim()).filter(Boolean),
      ...parsed.tags,
    ]));

    onAdd({
      title: parsed.title,
      categoryId: (parsed.categoryId ?? categoryId) || undefined,
      projectId: (parsed.projectId ?? projectId) || undefined,
      memo,
      date: nextPlanningState === "SCHEDULED" ? nextDate : UNSCHEDULED_DATE,
      dueDate: parsed.dueDate || dueDate || undefined,
      estimateMinutes: parsed.estimateMinutes ?? (estimateMinutes ? Number(estimateMinutes) : undefined),
      planningState: nextPlanningState,
      priority: parsed.priority || priority,
      repeat: parsed.repeat ?? repeat,
      tags: mergedTags,
    });
    reset();
    window.requestAnimationFrame(() => titleInputRef.current?.focus());
  };

  return (
    <form onSubmit={handleSubmit} className="app-card p-4">
      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(9rem,12rem)_auto] sm:items-center">
        <input ref={titleInputRef} data-quick-todo-input="true" className="field flex-1" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="할 일을 빠르게 입력하세요" aria-label="Todo 제목" />
        <select className="field" value={categoryId} onChange={(event) => setCategoryId(event.target.value)} aria-label="카테고리 선택">
          <option value="">미분류</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
        </select>
        <div className="flex"><button type="submit" className="btn-primary"><Plus size={18} />{submitLabel}</button></div>
      </div>
      {showSyntaxHint ? <p className="mt-1.5 px-1 text-[11px] text-ink-500">빠른 문법: 내일 · !high · @프로젝트 · +카테고리 · #태그 · 45m/1h · due:내일 · date:2026-08-20 · repeat:weekly · inbox/someday/waiting · 공백 이름은 @{"{"}프로젝트 이름{"}"} / +{"{"}카테고리 이름{"}"}</p> : null}
      <button type="button" className="mt-2 inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-semibold text-ink-400 transition hover:bg-ink-900/70 hover:text-ink-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/40" onClick={() => setShowDetails((value) => !value)} aria-expanded={showDetails}>
        <ChevronDown className={`transition ${showDetails ? "rotate-180" : ""}`} size={15} />상세 옵션
      </button>
      {showDetails ? (
        <TodoDetailFields
          date={date} dueDate={dueDate} priority={priority} categoryId={categoryId} projectId={projectId} planningState={planningState} estimateMinutes={estimateMinutes}
          repeat={repeat} tags={tags} memo={memo} categories={categories} projects={projects} showCategory={false}
          onDateChange={setDate} onDueDateChange={setDueDate} onPriorityChange={setPriority} onCategoryChange={setCategoryId} onProjectChange={setProjectId}
          onPlanningStateChange={setPlanningState} onEstimateMinutesChange={setEstimateMinutes} onRepeatChange={setRepeat} onTagsChange={setTags} onMemoChange={setMemo}
        />
      ) : null}
    </form>
  );
}
