import { FormEvent, useEffect, useMemo, useState } from "react";
import { BookmarkPlus, CalendarCheck2, CheckCircle2, ClipboardList, Plus, Save, Sparkles, Trash2 } from "lucide-react";
import { EmptyState } from "../components/common/EmptyState";
import { getWeekRange, todayKey } from "../lib/date";
import { builtInSmartViews, filterTodosBySavedView } from "../lib/planning";
import type { DailyPlan, SavedView, SavedViewQuery, TaskTemplate, WeeklyReview } from "../types/planning";
import type { Project } from "../types/project";
import type { Todo, TodoInput, TodoPlanningState, TodoPriority } from "../types/todo";

type PlanningTab = "daily" | "weekly" | "views" | "templates";

const tabItems: Array<{ id: PlanningTab; label: string }> = [
  { id: "daily", label: "오늘 계획" },
  { id: "weekly", label: "주간 리뷰" },
  { id: "views", label: "스마트 보기" },
  { id: "templates", label: "Todo 템플릿" },
];

const planningLabels: Record<TodoPlanningState, string> = {
  INBOX: "Inbox",
  SCHEDULED: "Scheduled",
  SOMEDAY: "Someday",
  WAITING: "Waiting",
};

const priorityLabels: Record<TodoPriority, string> = { LOW: "낮음", MEDIUM: "보통", HIGH: "높음" };

const TodoMiniList = ({ todos }: { todos: Todo[] }) => todos.length ? (
  <div className="space-y-2">
    {todos.slice(0, 20).map((todo) => (
      <div key={todo.id} className="flex items-start justify-between gap-3 rounded-lg border border-ink-800 bg-ink-950/35 px-3 py-2.5">
        <div className="min-w-0">
          <p className={`truncate text-sm font-semibold ${todo.completed ? "text-ink-500 line-through" : "text-ink-100"}`}>{todo.title}</p>
          <p className="mt-1 text-xs text-ink-500">
            {todo.dueDate ? `마감 ${todo.dueDate}` : `실행 ${todo.date}`} · {planningLabels[todo.planningState]} · {priorityLabels[todo.priority]}
          </p>
        </div>
        {todo.completed ? <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-300" /> : null}
      </div>
    ))}
    {todos.length > 20 ? <p className="text-xs text-ink-500">외 {todos.length - 20}개</p> : null}
  </div>
) : <EmptyState title="조건에 맞는 Todo가 없습니다." description="필터를 바꾸거나 Todo를 추가해보세요." />;

export function PlanningPage({
  todos,
  projects,
  dailyPlan,
  weeklyReview,
  savedViews,
  taskTemplates,
  onSaveDailyPlan,
  onSaveWeeklyReview,
  onAddSavedView,
  onDeleteSavedView,
  onAddTaskTemplate,
  onDeleteTaskTemplate,
  onAddTodo,
}: {
  todos: Todo[];
  projects: Project[];
  dailyPlan?: DailyPlan;
  weeklyReview?: WeeklyReview;
  savedViews: SavedView[];
  taskTemplates: TaskTemplate[];
  onSaveDailyPlan: (date: string, input: { focusText?: string; topTodoIds: string[] }) => Promise<DailyPlan | undefined>;
  onSaveWeeklyReview: (weekStartDate: string, input: { wins?: string; blockers?: string; lessons?: string; nextFocus?: string }) => Promise<WeeklyReview | undefined>;
  onAddSavedView: (input: { name: string; query: SavedViewQuery }) => Promise<SavedView | undefined>;
  onDeleteSavedView: (id: string) => Promise<boolean>;
  onAddTaskTemplate: (input: { name: string; todo: TodoInput }) => Promise<TaskTemplate | undefined>;
  onDeleteTaskTemplate: (id: string) => Promise<boolean>;
  onAddTodo: (input: TodoInput) => Promise<Todo | undefined> | Todo | undefined;
}) {
  const [tab, setTab] = useState<PlanningTab>("daily");
  const [message, setMessage] = useState("");
  const today = todayKey();
  const weekRange = getWeekRange();

  const [focusText, setFocusText] = useState("");
  const [topTodoIds, setTopTodoIds] = useState<string[]>([]);
  const [wins, setWins] = useState("");
  const [blockers, setBlockers] = useState("");
  const [lessons, setLessons] = useState("");
  const [nextFocus, setNextFocus] = useState("");

  useEffect(() => {
    setFocusText(dailyPlan?.focusText || "");
    setTopTodoIds(dailyPlan?.topTodoIds || []);
  }, [dailyPlan]);

  useEffect(() => {
    setWins(weeklyReview?.wins || "");
    setBlockers(weeklyReview?.blockers || "");
    setLessons(weeklyReview?.lessons || "");
    setNextFocus(weeklyReview?.nextFocus || "");
  }, [weeklyReview]);

  useEffect(() => {
    if (!message) return undefined;
    const timer = window.setTimeout(() => setMessage(""), 3500);
    return () => window.clearTimeout(timer);
  }, [message]);

  const planningCandidates = useMemo(() => todos
    .filter((todo) => !todo.archived && !todo.completed && todo.planningState !== "SOMEDAY")
    .sort((a, b) => {
      const priority = { HIGH: 0, MEDIUM: 1, LOW: 2 } as const;
      return priority[a.priority] - priority[b.priority] || (a.dueDate || a.date).localeCompare(b.dueDate || b.date);
    })
    .slice(0, 40), [todos]);

  const weekTodos = useMemo(() => todos.filter((todo) => todo.date >= weekRange.start && todo.date <= weekRange.end), [todos, weekRange.end, weekRange.start]);
  const completedWeekTodos = weekTodos.filter((todo) => todo.completed);

  const toggleTopTodo = (id: string) => {
    setTopTodoIds((current) => current.includes(id) ? current.filter((item) => item !== id) : current.length >= 5 ? current : [...current, id]);
  };

  const saveDaily = async () => {
    const saved = await onSaveDailyPlan(today, { focusText: focusText.trim() || undefined, topTodoIds });
    setMessage(saved ? "오늘 계획을 저장했습니다." : "오늘 계획을 저장하지 못했습니다.");
  };

  const saveWeekly = async () => {
    const saved = await onSaveWeeklyReview(weekRange.start, {
      wins: wins.trim() || undefined,
      blockers: blockers.trim() || undefined,
      lessons: lessons.trim() || undefined,
      nextFocus: nextFocus.trim() || undefined,
    });
    setMessage(saved ? "주간 리뷰를 저장했습니다." : "주간 리뷰를 저장하지 못했습니다.");
  };

  const [viewName, setViewName] = useState("");
  const [viewPlanningState, setViewPlanningState] = useState<"ALL" | TodoPlanningState>("ALL");
  const [viewPriority, setViewPriority] = useState<"ALL" | TodoPriority>("ALL");
  const [viewProjectId, setViewProjectId] = useState("ALL");
  const [viewDueMode, setViewDueMode] = useState<SavedViewQuery["dueMode"]>("ANY");
  const [activeView, setActiveView] = useState<{ name: string; query: SavedViewQuery }>(builtInSmartViews[0]);

  const activeViewTodos = useMemo(() => filterTodosBySavedView(todos, activeView.query, today), [activeView, today, todos]);

  const createSavedView = async (event: FormEvent) => {
    event.preventDefault();
    if (!viewName.trim()) return;
    const saved = await onAddSavedView({
      name: viewName.trim(),
      query: { planningState: viewPlanningState, priority: viewPriority, projectId: viewProjectId, dueMode: viewDueMode },
    });
    if (saved) {
      setViewName("");
      setMessage("보기를 저장했습니다.");
      setActiveView({ name: saved.name, query: saved.query });
    }
  };

  const [templateName, setTemplateName] = useState("");
  const [templateTitle, setTemplateTitle] = useState("");
  const [templateMemo, setTemplateMemo] = useState("");
  const [templatePriority, setTemplatePriority] = useState<TodoPriority>("MEDIUM");
  const [templatePlanningState, setTemplatePlanningState] = useState<TodoPlanningState>("SCHEDULED");
  const [templateProjectId, setTemplateProjectId] = useState("");
  const [templateEstimate, setTemplateEstimate] = useState("");
  const [templateTags, setTemplateTags] = useState("");

  const createTemplate = async (event: FormEvent) => {
    event.preventDefault();
    if (!templateName.trim() || !templateTitle.trim()) return;
    const estimateMinutes = Number(templateEstimate);
    const saved = await onAddTaskTemplate({
      name: templateName.trim(),
      todo: {
        title: templateTitle.trim(),
        memo: templateMemo.trim() || undefined,
        priority: templatePriority,
        planningState: templatePlanningState,
        workflowStatus: "TODO",
        projectId: templateProjectId || undefined,
        estimateMinutes: Number.isFinite(estimateMinutes) && estimateMinutes > 0 ? Math.round(estimateMinutes) : undefined,
        tags: templateTags.split(",").map((tag) => tag.trim().replace(/^#/, "")).filter(Boolean),
      },
    });
    if (saved) {
      setTemplateName(""); setTemplateTitle(""); setTemplateMemo(""); setTemplateEstimate(""); setTemplateTags("");
      setMessage("Todo 템플릿을 저장했습니다.");
    }
  };

  const useTemplate = async (template: TaskTemplate) => {
    const created = await onAddTodo({ ...template.todo, date: today });
    setMessage(created ? `“${template.name}” 템플릿으로 Todo를 만들었습니다.` : "Todo를 만들지 못했습니다.");
  };

  return (
    <div className="space-y-5">
      <section>
        <h2 className="text-2xl font-bold text-ink-100 sm:text-3xl">계획</h2>
        <p className="mt-2 text-sm text-ink-400">오늘 실행할 일, 주간 회고, 반복해서 보는 조건과 Todo 템플릿을 한곳에서 관리합니다.</p>
      </section>

      {message ? <div className="rounded-lg border border-accent-500/35 bg-accent-500/10 px-3 py-2 text-sm font-semibold text-accent-200" aria-live="polite">{message}</div> : null}

      <div className="flex gap-2 overflow-x-auto pb-1">
        {tabItems.map((item) => <button key={item.id} type="button" className={tab === item.id ? "btn-primary min-h-10 shrink-0" : "btn-secondary min-h-10 shrink-0"} onClick={() => setTab(item.id)}>{item.label}</button>)}
      </div>

      {tab === "daily" ? (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
          <section className="app-card space-y-4 p-4">
            <div className="flex items-center gap-2"><CalendarCheck2 size={18} className="text-accent-300" /><h3 className="font-bold text-ink-100">오늘의 초점</h3></div>
            <textarea className="field min-h-28" value={focusText} onChange={(event) => setFocusText(event.target.value)} placeholder="오늘 끝내고 싶은 가장 중요한 결과를 적어두세요." />
            <div>
              <p className="text-sm font-semibold text-ink-200">Top Todo {topTodoIds.length}/5</p>
              <p className="mt-1 text-xs text-ink-500">Todo의 날짜를 바꾸지 않고 오늘 집중할 작업만 따로 고릅니다.</p>
            </div>
            <button type="button" className="btn-primary w-full justify-center" onClick={() => void saveDaily()}><Save size={16} />오늘 계획 저장</button>
          </section>
          <section className="app-card p-4">
            <h3 className="font-bold text-ink-100">실행 후보</h3>
            <div className="mt-3 max-h-[32rem] space-y-2 overflow-y-auto pr-1">
              {planningCandidates.map((todo) => {
                const checked = topTodoIds.includes(todo.id);
                return <label key={todo.id} className={`flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5 ${checked ? "border-accent-500/55 bg-accent-500/10" : "border-ink-800 bg-ink-950/30"}`}>
                  <input type="checkbox" className="mt-1 h-4 w-4 accent-accent-500" checked={checked} onChange={() => toggleTopTodo(todo.id)} disabled={!checked && topTodoIds.length >= 5} />
                  <span className="min-w-0"><span className="block truncate text-sm font-semibold text-ink-100">{todo.title}</span><span className="mt-1 block text-xs text-ink-500">{todo.dueDate ? `마감 ${todo.dueDate}` : `실행 ${todo.date}`} · {priorityLabels[todo.priority]}</span></span>
                </label>;
              })}
            </div>
          </section>
        </div>
      ) : null}

      {tab === "weekly" ? (
        <div className="grid gap-4 xl:grid-cols-[18rem_minmax(0,1fr)]">
          <section className="app-card p-4">
            <h3 className="font-bold text-ink-100">이번 주</h3>
            <p className="mt-1 text-xs text-ink-500">{weekRange.start} ~ {weekRange.end}</p>
            <dl className="mt-4 grid grid-cols-2 gap-2">
              <div className="rounded-lg bg-ink-950/45 p-3"><dt className="text-xs text-ink-500">계획 Todo</dt><dd className="mt-1 text-xl font-bold text-ink-100">{weekTodos.length}</dd></div>
              <div className="rounded-lg bg-ink-950/45 p-3"><dt className="text-xs text-ink-500">완료 Todo</dt><dd className="mt-1 text-xl font-bold text-ink-100">{completedWeekTodos.length}</dd></div>
            </dl>
          </section>
          <section className="app-card space-y-4 p-4">
            <div className="grid gap-3 md:grid-cols-2">
              <label className="space-y-1 text-sm font-semibold text-ink-300">잘한 점<textarea className="field min-h-28" value={wins} onChange={(event) => setWins(event.target.value)} placeholder="이번 주에 잘 진행된 일" /></label>
              <label className="space-y-1 text-sm font-semibold text-ink-300">막힌 점<textarea className="field min-h-28" value={blockers} onChange={(event) => setBlockers(event.target.value)} placeholder="지연되거나 막힌 이유" /></label>
              <label className="space-y-1 text-sm font-semibold text-ink-300">배운 점<textarea className="field min-h-28" value={lessons} onChange={(event) => setLessons(event.target.value)} placeholder="다음에 유지하거나 바꿀 것" /></label>
              <label className="space-y-1 text-sm font-semibold text-ink-300">다음 주 초점<textarea className="field min-h-28" value={nextFocus} onChange={(event) => setNextFocus(event.target.value)} placeholder="다음 주 가장 중요한 결과" /></label>
            </div>
            <div className="flex justify-end"><button type="button" className="btn-primary" onClick={() => void saveWeekly()}><Save size={16} />주간 리뷰 저장</button></div>
          </section>
        </div>
      ) : null}

      {tab === "views" ? (
        <div className="grid gap-4 xl:grid-cols-[21rem_minmax(0,1fr)]">
          <aside className="space-y-4">
            <section className="app-card p-4">
              <div className="flex items-center gap-2"><Sparkles size={17} className="text-accent-300" /><h3 className="font-bold text-ink-100">Smart List</h3></div>
              <div className="mt-3 space-y-1">
                {builtInSmartViews.map((view) => <button key={view.id} type="button" className="w-full rounded-lg px-3 py-2 text-left hover:bg-ink-800" onClick={() => setActiveView(view)}><span className="block text-sm font-semibold text-ink-100">{view.name}</span><span className="mt-0.5 block text-xs text-ink-500">{view.description}</span></button>)}
              </div>
            </section>
            <section className="app-card p-4">
              <h3 className="font-bold text-ink-100">저장된 보기</h3>
              <div className="mt-3 space-y-1">
                {savedViews.map((view) => <div key={view.id} className="flex items-center gap-1"><button type="button" className="min-w-0 flex-1 truncate rounded-lg px-3 py-2 text-left text-sm font-semibold text-ink-200 hover:bg-ink-800" onClick={() => setActiveView({ name: view.name, query: view.query })}>{view.name}</button><button type="button" className="icon-btn h-9 w-9 rounded-md" aria-label={`${view.name} 삭제`} onClick={() => void onDeleteSavedView(view.id)}><Trash2 size={14} /></button></div>)}
                {!savedViews.length ? <p className="text-xs text-ink-500">아직 저장한 보기가 없습니다.</p> : null}
              </div>
            </section>
          </aside>
          <div className="space-y-4">
            <section className="app-card p-4">
              <div className="flex items-center justify-between gap-3"><div><h3 className="font-bold text-ink-100">{activeView.name}</h3><p className="mt-1 text-xs text-ink-500">현재 조건에 맞는 Todo {activeViewTodos.length}개</p></div><ClipboardList size={18} className="text-ink-500" /></div>
              <div className="mt-4"><TodoMiniList todos={activeViewTodos} /></div>
            </section>
            <form className="app-card space-y-3 p-4" onSubmit={createSavedView}>
              <div className="flex items-center gap-2"><BookmarkPlus size={17} className="text-accent-300" /><h3 className="font-bold text-ink-100">새 보기 저장</h3></div>
              <input className="field" value={viewName} onChange={(event) => setViewName(event.target.value)} placeholder="보기 이름" />
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <select className="field" value={viewPlanningState} onChange={(event) => setViewPlanningState(event.target.value as "ALL" | TodoPlanningState)}><option value="ALL">모든 계획 상태</option><option value="INBOX">Inbox</option><option value="SCHEDULED">Scheduled</option><option value="WAITING">Waiting</option><option value="SOMEDAY">Someday</option></select>
                <select className="field" value={viewPriority} onChange={(event) => setViewPriority(event.target.value as "ALL" | TodoPriority)}><option value="ALL">모든 우선순위</option><option value="HIGH">높음</option><option value="MEDIUM">보통</option><option value="LOW">낮음</option></select>
                <select className="field" value={viewProjectId} onChange={(event) => setViewProjectId(event.target.value)}><option value="ALL">모든 프로젝트</option><option value="NO_PROJECT">프로젝트 없음</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select>
                <select className="field" value={viewDueMode || "ANY"} onChange={(event) => setViewDueMode(event.target.value as SavedViewQuery["dueMode"])}><option value="ANY">모든 마감</option><option value="OVERDUE">마감 초과</option><option value="DUE_SOON">3일 내 마감</option><option value="NO_DUE">마감 없음</option></select>
              </div>
              <div className="flex justify-end"><button type="submit" className="btn-primary"><Plus size={16} />보기 저장</button></div>
            </form>
          </div>
        </div>
      ) : null}

      {tab === "templates" ? (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
          <form className="app-card space-y-3 p-4" onSubmit={createTemplate}>
            <h3 className="font-bold text-ink-100">새 Todo 템플릿</h3>
            <input className="field" value={templateName} onChange={(event) => setTemplateName(event.target.value)} placeholder="템플릿 이름 (예: 블로그 글 작성)" />
            <input className="field" value={templateTitle} onChange={(event) => setTemplateTitle(event.target.value)} placeholder="Todo 제목" />
            <textarea className="field min-h-24" value={templateMemo} onChange={(event) => setTemplateMemo(event.target.value)} placeholder="기본 메모" />
            <div className="grid gap-3 sm:grid-cols-2">
              <select className="field" value={templatePriority} onChange={(event) => setTemplatePriority(event.target.value as TodoPriority)}><option value="HIGH">높음</option><option value="MEDIUM">보통</option><option value="LOW">낮음</option></select>
              <select className="field" value={templatePlanningState} onChange={(event) => setTemplatePlanningState(event.target.value as TodoPlanningState)}><option value="SCHEDULED">Scheduled</option><option value="INBOX">Inbox</option><option value="WAITING">Waiting</option><option value="SOMEDAY">Someday</option></select>
              <select className="field" value={templateProjectId} onChange={(event) => setTemplateProjectId(event.target.value)}><option value="">프로젝트 없음</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select>
              <input className="field" type="number" min="1" max="1440" value={templateEstimate} onChange={(event) => setTemplateEstimate(event.target.value)} placeholder="예상 시간(분)" />
            </div>
            <input className="field" value={templateTags} onChange={(event) => setTemplateTags(event.target.value)} placeholder="태그, 쉼표로 구분" />
            <div className="flex justify-end"><button type="submit" className="btn-primary"><Plus size={16} />템플릿 저장</button></div>
          </form>
          <section className="app-card p-4">
            <h3 className="font-bold text-ink-100">저장된 템플릿</h3>
            <div className="mt-3 space-y-2">
              {taskTemplates.map((template) => <div key={template.id} className="rounded-lg border border-ink-800 bg-ink-950/35 p-3"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="font-semibold text-ink-100">{template.name}</p><p className="mt-1 truncate text-sm text-ink-300">{template.todo.title}</p><p className="mt-1 text-xs text-ink-500">{priorityLabels[template.todo.priority || "MEDIUM"]} · {planningLabels[template.todo.planningState || "SCHEDULED"]}{template.todo.estimateMinutes ? ` · ${template.todo.estimateMinutes}분` : ""}</p></div><button type="button" className="icon-btn h-9 w-9 rounded-md" aria-label={`${template.name} 삭제`} onClick={() => void onDeleteTaskTemplate(template.id)}><Trash2 size={14} /></button></div><button type="button" className="btn-secondary mt-3 min-h-9 px-3 py-1 text-xs" onClick={() => void useTemplate(template)}>오늘 Todo 만들기</button></div>)}
              {!taskTemplates.length ? <EmptyState title="저장된 템플릿이 없습니다." description="반복해서 만드는 Todo의 기본값을 템플릿으로 저장해보세요." /> : null}
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
