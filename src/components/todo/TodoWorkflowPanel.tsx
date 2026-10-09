import { useEffect, useState } from "react";
import { api, jsonBody } from "../../lib/api/client";
import type { Todo } from "../../types/todo";

type RelatedTodo = { id: string; title: string; completed: number | boolean; workflowStatus: string };
type Activity = { id: string; action: "CREATED" | "UPDATED"; createdAt: string; changes: { before?: Record<string, unknown>; after?: Record<string, unknown> } };
type Reminder = { remindAt: string; status: "PENDING" | "SENT" | "CANCELLED"; sentAt: string | null };
type Workflow = { blockers: RelatedTodo[]; dependents: RelatedTodo[]; activity: Activity[]; reminder: Reminder | null; reminderDeliveryConfigured: boolean };

const FIELD_LABELS: Record<string, string> = {
  title: "제목", memo: "메모", referenceUrl: "관련 링크", referenceLabel: "링크 이름", date: "실행일", dueDate: "마감일",
  startTime: "시작 시각", endTime: "종료 시각", estimateMinutes: "예상 시간", planningState: "보관 위치", workflowStatus: "작업 상태",
  priority: "우선순위", repeat: "반복", projectId: "프로젝트", milestoneId: "마일스톤", parentTodoId: "상위 작업",
  categoryId: "카테고리", completed: "완료", archived: "보관",
};
const STATE_LABELS: Record<string, string> = {
  INBOX: "Inbox", SCHEDULED: "일정", SOMEDAY: "Someday", WAITING: "Waiting", TODO: "Todo",
  IN_PROGRESS: "진행 중", BLOCKED: "Blocked", DONE: "완료", LOW: "낮음", MEDIUM: "보통", HIGH: "높음",
  NONE: "반복 없음", DAILY: "매일", WEEKLY: "매주", MONTHLY: "매월", WEEKDAY: "평일", WEEKEND: "주말",
};
const displayValue = (field: string, value: unknown) => {
  if (field.endsWith("Id")) return value ? "연결됨" : "없음";
  if (typeof value === "boolean" || field === "completed" || field === "archived") return value ? "예" : "아니요";
  if (value == null || value === "") return "없음";
  if (field === "date" && value === "9999-12-31") return "미지정";
  if (["memo", "referenceUrl", "referenceLabel"].includes(field) && String(value).length > 80) return `${String(value).slice(0, 79)}…`;
  return STATE_LABELS[String(value)] || String(value);
};
const toDateTimeInput = (value?: string) => {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
};

export function TodoWorkflowPanel({ todo }: { todo: Todo }) {
  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [reminderInput, setReminderInput] = useState("");
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<RelatedTodo[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const reload = async () => {
    const next = await api<Workflow>(`/api/todos/${todo.id}/workflow`);
    setWorkflow(next);
    setReminderInput(toDateTimeInput(next.reminder?.remindAt));
  };

  useEffect(() => {
    let active = true;
    setWorkflow(null);
    setError("");
    api<Workflow>(`/api/todos/${todo.id}/workflow`).then((next) => {
      if (!active) return;
      setWorkflow(next);
      setReminderInput(toDateTimeInput(next.reminder?.remindAt));
    }).catch((cause: unknown) => {
      if (active) setError(cause instanceof Error ? cause.message : "작업 정보를 불러오지 못했습니다.");
    });
    return () => { active = false; };
  }, [todo.id]);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) { setOptions([]); return; }
    let active = true;
    const timer = window.setTimeout(() => {
      api<{ todos: RelatedTodo[] }>(`/api/todos/${todo.id}/dependency-options?q=${encodeURIComponent(trimmed)}`)
        .then((result) => { if (active) setOptions(result.todos); })
        .catch(() => { if (active) setOptions([]); });
    }, 180);
    return () => { active = false; window.clearTimeout(timer); };
  }, [query, todo.id]);

  const mutate = async (action: () => Promise<unknown>, success: string) => {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await action();
      await reload();
      setNotice(success);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "저장하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  };

  const addBlocker = async (blockingTodoId: string) => {
    await mutate(() => api(`/api/todos/${todo.id}/dependencies`, { method: "POST", ...jsonBody({ blockingTodoId }) }), "선행 작업을 연결했습니다.");
    setQuery("");
    setOptions([]);
  };

  const saveReminder = () => mutate(
    () => api(`/api/todos/${todo.id}/reminder`, { method: "PUT", ...jsonBody({ remindAt: reminderInput ? new Date(reminderInput).toISOString() : null }) }),
    reminderInput ? "알림 시각을 저장했습니다." : "알림을 해제했습니다.",
  );

  const changeRows = (entry: Activity) => {
    if (entry.action === "CREATED") return ["작업을 만들었습니다."];
    const before = entry.changes.before || {}, after = entry.changes.after || {};
    return Object.keys(FIELD_LABELS).filter((field) => JSON.stringify(before[field]) !== JSON.stringify(after[field]))
      .map((field) => {
        if (field.endsWith("Id") && before[field] && after[field]) return `${FIELD_LABELS[field]} 연결 변경`;
        return `${FIELD_LABELS[field]}: ${displayValue(field, before[field])} → ${displayValue(field, after[field])}`;
      });
  };

  const isResolved = todo.completed || todo.archived;
  return (
    <details className="mt-4 rounded-lg border border-ink-700/60 bg-ink-950/30 p-3 md:col-span-2">
      <summary className="cursor-pointer text-sm font-semibold text-ink-200">선행 작업 · 개별 알림 · 변경 이력</summary>
      {!workflow && !error ? <p className="mt-3 text-xs text-ink-500">작업 정보를 불러오는 중입니다.</p> : null}
      <div className="mt-3 grid gap-4 lg:grid-cols-2">
        <section className="space-y-2">
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wide text-ink-300">선행 작업</h4>
            <p className="mt-1 text-xs text-ink-500">완료되어야 이 작업을 시작할 수 있는 항목을 연결합니다.</p>
          </div>
          <input className="field" value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") event.preventDefault(); }} placeholder="작업 제목으로 검색" aria-label="선행 작업 검색" />
          {options.length ? <div className="max-h-36 overflow-y-auto rounded-md border border-ink-700/70 bg-ink-900 p-1">
            {options.filter((option) => !workflow?.blockers.some((item) => item.id === option.id)).map((option) => (
              <button key={option.id} type="button" disabled={busy} onClick={() => void addBlocker(option.id)} className="flex min-h-9 w-full items-center justify-between gap-2 rounded px-2 text-left text-xs text-ink-200 hover:bg-ink-800">
                <span className="truncate">{option.title}</span><span className="shrink-0 text-ink-500">{option.completed ? "완료" : option.workflowStatus === "IN_PROGRESS" ? "진행 중" : "추가"}</span>
              </button>
            ))}
          </div> : null}
          <ul className="space-y-1.5">
            {workflow?.blockers.map((blocker) => <li key={blocker.id} className="flex min-h-9 items-center justify-between gap-2 rounded-md bg-ink-900 px-2.5 text-xs">
              <span className="min-w-0 truncate text-ink-200">{blocker.title}</span>
              <span className={`shrink-0 ${blocker.completed ? "text-success" : "text-warning"}`}>{blocker.completed ? "완료" : "미완료"}</span>
              <button type="button" className="shrink-0 text-ink-500 hover:text-red-200" disabled={busy} onClick={() => void mutate(() => api(`/api/todos/${todo.id}/dependencies/${blocker.id}`, { method: "DELETE" }), "선행 작업을 해제했습니다.")}>해제</button>
            </li>)}
          </ul>
          {workflow?.blockers.some((blocker) => !blocker.completed) ? <p className="text-xs font-semibold text-warning">미완료 선행 작업 {workflow.blockers.filter((blocker) => !blocker.completed).length}개가 남아 있습니다.</p> : null}
          {workflow?.dependents.length ? <p className="text-xs text-ink-500">이 작업 다음에 진행할 작업 {workflow.dependents.length}개</p> : null}
          {workflow?.blockers.length === 0 ? <p className="text-xs text-ink-500">연결된 선행 작업이 없습니다.</p> : null}
        </section>

        <section className="space-y-2">
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wide text-ink-300">개별 알림</h4>
            <p className="mt-1 text-xs text-ink-500">설정한 시각에 Discord로 한 번 알립니다.</p>
          </div>
          {workflow?.reminderDeliveryConfigured === false ? <p className="rounded-md bg-warning/10 px-2.5 py-2 text-xs text-warning">Discord 알림 웹훅이 설정되지 않아 발송되지 않습니다.</p> : null}
          <div className="flex flex-wrap items-center gap-2">
            <input className="field min-w-52 flex-1" type="datetime-local" value={reminderInput} onChange={(event) => setReminderInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") event.preventDefault(); }} disabled={isResolved} aria-label="개별 알림 시각" />
            <button type="button" className="btn-secondary min-h-9 px-3 py-1 text-xs" onClick={() => void saveReminder()} disabled={busy || isResolved}>{reminderInput ? "알림 저장" : "알림 해제"}</button>
          </div>
          {workflow?.reminder ? <p className="text-xs text-ink-500">상태: {workflow.reminder.status === "PENDING" ? "예약됨" : workflow.reminder.status === "SENT" ? "발송 완료" : "해제됨"}</p> : null}
          {isResolved ? <p className="text-xs text-ink-500">완료 또는 보관된 작업에는 알림을 설정할 수 없습니다.</p> : null}
        </section>

        <section className="lg:col-span-2">
          <h4 className="text-xs font-bold uppercase tracking-wide text-ink-300">변경 이력</h4>
          {!workflow?.activity.length ? <p className="mt-2 text-xs text-ink-500">아직 기록된 변경이 없습니다.</p> : <ol className="mt-2 max-h-40 space-y-2 overflow-y-auto border-l border-ink-700 pl-3">
            {workflow.activity.slice(0, 12).map((entry) => <li key={entry.id} className="text-xs">
              <p className="text-ink-400">{new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(entry.createdAt))}</p>
              <p className="mt-0.5 break-words text-ink-200">{changeRows(entry).join(" · ")}</p>
            </li>)}
          </ol>}
        </section>
      </div>
      {error ? <p className="mt-3 text-xs font-semibold text-red-200" role="alert">{error}</p> : null}
      {notice ? <p className="mt-3 text-xs text-success" role="status">{notice}</p> : null}
    </details>
  );
}
