import { addDays } from "date-fns";
import { CalendarPlus, Inbox, MoreHorizontal, Trash2 } from "lucide-react";
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
  onAdd: (input: TodoInput) => void;
  onUpdate: (id: string, updates: Partial<Omit<Todo, "id" | "createdAt">>) => void;
  onDelete: (id: string) => void;
}) {
  const today = todayKey();
  const tomorrow = toDateKey(addDays(parseDateKey(today), 1));
  const inboxTodos = todos.filter((todo) => todo.planningState === "INBOX" && !todo.archived);

  const schedule = (todo: Todo, date: string) => onUpdate(todo.id, { planningState: "SCHEDULED", date });
  const moveBucket = (todo: Todo, planningState: TodoPlanningState) => onUpdate(todo.id, { planningState, date: UNSCHEDULED_DATE });

  return (
    <div className="space-y-5">
      <section>
        <div className="flex items-center gap-3"><Inbox size={24} className="text-accent-300" /><div><h2 className="text-2xl font-bold text-ink-100 sm:text-3xl">Inbox</h2><p className="mt-1 text-sm text-ink-400">날짜와 프로젝트를 아직 정하지 않은 생각을 먼저 담고, 나중에 일정으로 보내세요.</p></div></div>
      </section>

      <TodoForm compact submitLabel="Inbox에 저장" categories={categories} projects={projects} defaultPlanningState="INBOX" defaultDate={UNSCHEDULED_DATE} onAdd={onAdd} />

      <section className="app-card p-4">
        <div className="mb-3 flex items-center justify-between"><h3 className="font-bold text-ink-100">미분류 작업</h3><span className="rounded-full bg-ink-950/70 px-2 py-0.5 text-xs text-ink-400">{inboxTodos.length}개</span></div>
        <div className="space-y-2">
          {inboxTodos.map((todo) => (
            <article key={todo.id} className="rounded-xl border border-ink-700/70 bg-ink-950/40 p-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1"><h4 className="break-words text-sm font-semibold text-ink-100">{todo.title}</h4><div className="mt-1 flex flex-wrap gap-2 text-[11px] text-ink-500">{todo.category?.name ? <span>{todo.category.name}</span> : null}{todo.estimateMinutes ? <span>{todo.estimateMinutes}분 예상</span> : null}{todo.dueDate ? <span>마감 {todo.dueDate}</span> : null}</div></div>
                <div className="flex flex-wrap gap-1.5">
                  <button type="button" className="btn-secondary min-h-9 px-2.5 py-1 text-xs" onClick={() => schedule(todo, today)}><CalendarPlus size={14} />오늘</button>
                  <button type="button" className="btn-secondary min-h-9 px-2.5 py-1 text-xs" onClick={() => schedule(todo, tomorrow)}>내일</button>
                  <button type="button" className="btn-secondary min-h-9 px-2.5 py-1 text-xs" onClick={() => moveBucket(todo, "SOMEDAY")}><MoreHorizontal size={14} />Someday</button>
                  <button type="button" className="btn-secondary min-h-9 px-2.5 py-1 text-xs" onClick={() => moveBucket(todo, "WAITING")}>Waiting</button>
                  <button type="button" className="icon-btn h-9 w-9 rounded-md hover:text-red-200" onClick={() => window.confirm(`“${todo.title}” Todo를 삭제할까요?`) && onDelete(todo.id)} aria-label="Inbox Todo 삭제"><Trash2 size={14} /></button>
                </div>
              </div>
            </article>
          ))}
          {!inboxTodos.length ? <div className="rounded-lg border border-dashed border-ink-700/70 px-4 py-10 text-center"><p className="text-sm font-semibold text-ink-400">Inbox가 비어 있습니다.</p><p className="mt-1 text-xs text-ink-600">떠오른 작업을 부담 없이 먼저 저장해보세요.</p></div> : null}
        </div>
      </section>
    </div>
  );
}
