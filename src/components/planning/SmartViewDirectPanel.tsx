import { ClipboardList, Sparkles } from "lucide-react";
import { builtInSmartViews, filterTodosBySavedView } from "../../lib/planning";
import { todayKey } from "../../lib/date";
import type { Todo } from "../../types/todo";

const planningLabel = { INBOX: "Inbox", SCHEDULED: "Scheduled", SOMEDAY: "Someday", WAITING: "Waiting" } as const;
const priorityLabel = { LOW: "낮음", MEDIUM: "보통", HIGH: "높음" } as const;

export function SmartViewDirectPanel({
  todos,
  smartViewId,
  onExit,
}: {
  todos: Todo[];
  smartViewId: string;
  onExit?: () => void;
}) {
  const view = builtInSmartViews.find((item) => item.id === smartViewId) || builtInSmartViews[0];
  const visibleTodos = filterTodosBySavedView(todos, view.query, todayKey());

  return (
    <div className="space-y-5">
      <section className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold text-accent-300">계획 / 스마트 보기</p>
          <div className="mt-1 flex items-center gap-2">
            <Sparkles size={19} className="text-accent-300" />
            <h2 className="text-2xl font-bold text-ink-100 sm:text-3xl">{view.name}</h2>
          </div>
          <p className="mt-2 text-sm text-ink-400">{view.description}</p>
        </div>
        {onExit ? <button type="button" className="btn-secondary shrink-0" onClick={onExit}>계획 전체 보기</button> : null}
      </section>

      <section className="app-card p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="font-bold text-ink-100">현재 Todo</h3>
            <p className="mt-1 text-xs text-ink-500">조건에 맞는 Todo {visibleTodos.length}개</p>
          </div>
          <ClipboardList size={18} className="text-ink-500" />
        </div>

        {visibleTodos.length ? (
          <div className="mt-4 space-y-1.5">
            {visibleTodos.slice(0, 80).map((todo) => (
              <div key={todo.id} className="rounded-md border border-ink-800/75 bg-ink-950/25 px-3 py-2.5">
                <div className="flex min-w-0 items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className={`truncate text-sm font-semibold ${todo.completed ? "text-ink-500 line-through" : "text-ink-100"}`}>{todo.title}</p>
                    <p className="mt-1 text-[11px] text-ink-500">
                      {todo.dueDate ? `마감 ${todo.dueDate}` : `실행 ${todo.date}`} · {planningLabel[todo.planningState]} · {priorityLabel[todo.priority]}
                      {todo.category?.name ? ` · ${todo.category.name}` : ""}
                    </p>
                  </div>
                  {todo.projectId ? <span className="shrink-0 rounded-full border border-ink-700/65 px-2 py-0.5 text-[10px] font-semibold text-ink-500">프로젝트</span> : null}
                </div>
              </div>
            ))}
            {visibleTodos.length > 80 ? <p className="pt-2 text-center text-xs text-ink-500">외 {visibleTodos.length - 80}개</p> : null}
          </div>
        ) : (
          <div className="mt-4 rounded-md border border-dashed border-ink-700/55 px-4 py-8 text-center">
            <p className="text-sm font-semibold text-ink-400">조건에 맞는 Todo가 없습니다.</p>
          </div>
        )}
      </section>
    </div>
  );
}
