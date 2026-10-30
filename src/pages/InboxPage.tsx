import { useState } from "react";
import { addDays } from "date-fns";
import { CalendarPlus, Inbox, MoreHorizontal, Trash2 } from "lucide-react";
import { PageHeader } from "../components/common/PageHeader";
import { TodoForm } from "../components/todo/TodoForm";
import { parseDateKey, todayKey, toDateKey } from "../lib/date";
import type { Category } from "../types/category";
import type { Project } from "../types/project";
import type { Todo, TodoInput, TodoPlanningState } from "../types/todo";

const UNSCHEDULED_DATE = "9999-12-31";

export function InboxPage({ todos, categories, projects, onAdd, onUpdate, onDelete }: {
  todos: Todo[];
  categories: Category[];
  projects: Project[];
  onAdd: (input: TodoInput) => Promise<Todo | undefined> | Todo | undefined;
  onUpdate: (id: string, updates: Partial<Omit<Todo, "id" | "createdAt">>) => Promise<Todo | undefined> | Todo | undefined;
  onDelete: (id: string) => void;
}) {
  const today = todayKey();
  const tomorrow = toDateKey(addDays(parseDateKey(today), 1));
  const inboxTodos = todos.filter((todo) => todo.planningState === "INBOX" && !todo.archived);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [chosenDates, setChosenDates] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState<{ error: boolean; message: string } | null>(null);

  const updateBucket = async (todo: Todo, planningState: TodoPlanningState, date: string) => {
    if (busyId || (planningState === "SCHEDULED" && !/^\d{4}-\d{2}-\d{2}$/.test(date))) return;
    setBusyId(todo.id);
    setFeedback(null);
    try {
      const updated = await onUpdate(todo.id, { planningState, date });
      if (!updated) {
        setFeedback({ error: true, message: `“${todo.title}” 이동에 실패했습니다. 받은함에 그대로 남아 있습니다.` });
        return;
      }
      setFeedback({ error: false, message: `“${todo.title}”을 ${planningState === "SCHEDULED" ? date + " 일정" : planningState === "SOMEDAY" ? "언젠가" : "대기"}으로 옮겼습니다.` });
    } catch {
      setFeedback({ error: true, message: `“${todo.title}” 이동에 실패했습니다. 다시 시도해 주세요.` });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="page-shell">
      <PageHeader title="받은함" icon={<Inbox size={19} />}
        description="떠오른 작업을 먼저 저장한 뒤, 오늘·내일 또는 원하는 날짜로 계획하세요."
        meta={`미계획 ${inboxTodos.length}개`}
      />
      <section className="space-y-2" aria-label="받은함 Todo 작성">
        <h3 className="text-sm font-semibold text-ink-200">생각 빠르게 기록하기</h3>
        <TodoForm compact submitLabel="받은함에 저장" categories={categories} projects={projects} defaultPlanningState="INBOX" defaultDate={UNSCHEDULED_DATE} onAdd={onAdd} />
      </section>

      {feedback ? (
        <p role={feedback.error ? "alert" : "status"} className={`rounded-lg border px-3 py-2 text-sm ${feedback.error ? "border-danger/35 bg-danger/[0.06] text-red-200" : "border-success/30 bg-success/[0.04] text-ink-200"}`}>
          {feedback.message}
        </p>
      ) : null}

      <section className="app-card p-3 sm:p-4" aria-label="받은함 작업">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="text-sm font-bold text-ink-100">계획하지 않은 작업</h3>
          <span className="page-meta">{inboxTodos.length}개</span>
        </div>
        <div className="space-y-2">
          {inboxTodos.map((todo) => (
            <article key={todo.id} className="page-list-item">
              <div className="flex flex-col gap-3">
                <div className="flex min-w-0 items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <h4 className="break-words text-sm font-semibold leading-6 text-ink-100">{todo.title}</h4>
                    <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-ink-400">
                      {todo.category?.name ? <span>{todo.category.name}</span> : null}
                      {todo.dueDate ? <span>마감 {todo.dueDate}</span> : null}
                    </div>
                  </div>
                  <button type="button" className="icon-btn h-9 w-9 shrink-0 hover:text-red-200"
                    onClick={() => window.confirm(`“${todo.title}” Todo를 삭제할까요?`) && onDelete(todo.id)}
                    disabled={busyId !== null} aria-label={`${todo.title} 받은함에서 삭제`}><Trash2 size={14} /></button>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button type="button" className="btn-secondary min-h-9 px-2.5 text-xs" disabled={busyId !== null}
                    onClick={() => void updateBucket(todo, "SCHEDULED", today)}><CalendarPlus size={14} />오늘</button>
                  <button type="button" className="btn-secondary min-h-9 px-2.5 text-xs" disabled={busyId !== null}
                    onClick={() => void updateBucket(todo, "SCHEDULED", tomorrow)}>내일</button>
                  <label className="flex min-w-0 flex-1 items-center gap-1.5 sm:flex-initial">
                    <span className="sr-only">{todo.title} 실행일</span>
                    <input type="date" className="field min-w-[8.75rem] max-w-44 text-xs" aria-label={`${todo.title} 실행일`}
                      value={chosenDates[todo.id] || ""} disabled={busyId !== null}
                      onChange={(event) => setChosenDates((current) => ({ ...current, [todo.id]: event.target.value }))} />
                  </label>
                  <button type="button" className="btn-secondary min-h-9 px-2.5 text-xs"
                    onClick={() => void updateBucket(todo, "SCHEDULED", chosenDates[todo.id] || "")}
                    disabled={busyId !== null || !chosenDates[todo.id]}>날짜 지정</button>
                  <div className="flex flex-wrap gap-1.5 sm:ml-auto">
                    <button type="button" className="btn-secondary min-h-9 px-2.5 text-xs" disabled={busyId !== null}
                      onClick={() => void updateBucket(todo, "SOMEDAY", UNSCHEDULED_DATE)}><MoreHorizontal size={14} />언젠가</button>
                    <button type="button" className="btn-secondary min-h-9 px-2.5 text-xs" disabled={busyId !== null}
                      onClick={() => void updateBucket(todo, "WAITING", UNSCHEDULED_DATE)}>대기</button>
                  </div>
                </div>
                {busyId === todo.id ? <p className="text-xs text-ink-400" role="status">이동 저장 중…</p> : null}
              </div>
            </article>
          ))}
          {!inboxTodos.length ? (
            <div className="rounded-lg border border-dashed border-ink-700/70 px-4 py-10 text-center">
              <p className="text-sm font-semibold text-ink-200">받은함이 비어 있습니다.</p>
              <p className="mt-1.5 text-xs text-ink-400">떠오른 작업을 위 입력창에 저장해 보세요.</p>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
