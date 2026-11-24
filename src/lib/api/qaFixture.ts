import type { ActiveTimer, TimeEntry } from "../../types/timeTracking";
import type { TimeBlock } from "../../types/time";
import type { TodoTrashEntry, TodoRestorePreview } from "../../types/trash";
import { todayKey } from "../date";
import type { Todo } from "../../types/todo";
import type { Category } from "../../types/category";
import type { Project } from "../../types/project";
import type { Memo } from "../../types/memo";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
export function createQaFetch(now: () => number = Date.now): typeof fetch {
const stamp = new Date(now()).toISOString();
const day = todayKey(new Date(now()));
let sequence = 0;
const id = () => `qa-created-${++sequence}`;
const timestamp = () => new Date(now()).toISOString();
const categories: Category[] = [{ id: "qa-study", userId: "qa", name: "Study", color: "#79a7f7", order: 0, createdAt: stamp, updatedAt: stamp }];
const projects: Project[] = [{ id: "qa-project", name: "QA 프로젝트", resources: [{ id: "qa-resource", label: "GitHub 예시", url: "https://github.com/qa-example/demo" }], status: "ACTIVE", archived: false, order: 0, createdAt: stamp, updatedAt: stamp }];
const todos: Todo[] = [
  { id: "qa-todo-1", title: "디자인 검증", categoryId: "qa-study", projectId: "qa-project", category: categories[0], date: day, planningState: "SCHEDULED", workflowStatus: "TODO", priority: "HIGH", completed: false, archived: false, createdAt: stamp, updatedAt: stamp, order: 0 },
  { id: "qa-todo-2", title: "프로젝트 상태 확인", projectId: "qa-project", date: day, planningState: "SCHEDULED", workflowStatus: "IN_PROGRESS", priority: "MEDIUM", completed: false, archived: false, createdAt: stamp, updatedAt: stamp, order: 1 },
];
const entries: TimeEntry[] = [];
const blocks: TimeBlock[] = [];
const trash = new Map<string, { entry: TodoTrashEntry; todo: Todo }>();
const reflections = new Map<string, string>();
let activeTimer: ActiveTimer | null = null;
let settings = { carryOverEnabled: false, autoArchiveCompleted: false, reminderTodayEnabled: false, reminderOverdueEnabled: false, reminderDueSoonEnabled: false, reminderDueSoonDays: 3, dailyGoalMinutes: 0, wipLimits: {} };
const memos: Memo[] = [{ id: "qa-memo", title: "QA 예시 메모", content: "# 화면 검증\n\n- 탭 이동\n- 편집기 확인", pinned: false, todoIds: [], projectIds: ["qa-project"], createdAt: stamp, updatedAt: stamp }];
let scratchpad = { content: "# QA 낙서장\n\n운영 데이터가 아닌 예시 문서입니다.", updatedAt: stamp };

/** Build-time QA only. Fail closed: never fall through to a real API, even for unknown routes. */
return async (input, init) => {
  if (init?.signal?.aborted) throw new DOMException("요청이 취소되었습니다.", "AbortError");
  if (typeof input !== "string" || !input.startsWith("/api/")) return json({ message: "QA 모드에서는 외부 요청을 허용하지 않습니다." }, 403);
  const url = new URL(input, "https://qa.invalid");
  if (url.origin !== "https://qa.invalid" || !url.pathname.startsWith("/api/")) return json({ message: "허용되지 않은 QA 경로" }, 403);
  const method = (init?.method ?? "GET").toUpperCase();
  if (method === "POST" && url.pathname === "/api/planner-automations/run") return json({ automation: { plannerDate: todayKey(), carriedOver: 0, autoArchived: 0 } });
  if (method === "PUT" && url.pathname === "/api/scratchpad") {
    try {
      const body = JSON.parse(String(init?.body ?? "{}"));
      if (typeof body.content !== "string") return json({ message: "잘못된 예시 문서" }, 400);
      scratchpad = { content: body.content, updatedAt: new Date().toISOString() };
      return json({ scratchpad });
    } catch { return json({ message: "잘못된 요청" }, 400); }
  }
  const path = url.pathname;
  const segments = path.split("/").slice(2);
  const [collection, key, action] = segments;
  let body: Record<string, unknown> = {};
  if (init?.body) {
    try {
      const parsed: unknown = JSON.parse(String(init.body));
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return json({ message: "잘못된 QA 요청" }, 400);
      body = parsed as Record<string, unknown>;
    } catch { return json({ message: "잘못된 QA 요청" }, 400); }
  }
  const bad = (message = "잘못된 QA 입력") => json({ message }, 400);
  const missing = () => json({ message: "QA 항목을 찾을 수 없습니다." }, 404);
  const ok = () => json({ ok: true });
  const text = (value: unknown) => typeof value === "string" ? value : undefined;
  const listIds = (value: unknown): string[] | undefined => Array.isArray(value) && value.every(item => typeof item === "string") ? [...new Set(value)] : undefined;
  const upsert = <T extends { id: string }>(items: T[], row: T) => {
    const index = items.findIndex(item => item.id === row.id);
    if (index >= 0) items[index] = row; else items.push(row);
  };
  const setTodo = (todo: Todo) => {
    todo.category = categories.find(item => item.id === todo.categoryId);
    todo.completed = todo.workflowStatus === "DONE";
    upsert(todos, todo);
    return todo;
  };
  const buildTodo = (todoId: string, existing?: Todo): Todo | null => {
    if (typeof body.title !== "string" || !body.title.trim()) return null;
    const status = ["TODO", "IN_PROGRESS", "BLOCKED", "DONE"].includes(String(body.workflowStatus)) ? body.workflowStatus as Todo["workflowStatus"] : existing?.workflowStatus ?? "TODO";
    const categoryId = text(body.categoryId);
    const projectId = text(body.projectId);
    if (categoryId && !categories.some(item => item.id === categoryId) || projectId && !projects.some(item => item.id === projectId)) return null;
    const parentTodoId = text(body.parentTodoId);
    if (parentTodoId && (!todos.some(item => item.id === parentTodoId && item.projectId === projectId) || parentTodoId === todoId)) return null;
    return {
      id: todoId, title: body.title.trim(), memo: text(body.memo), categoryId, projectId, parentTodoId,
      referenceUrl: text(body.referenceUrl), referenceLabel: text(body.referenceLabel),
      planningState: ["SCHEDULED", "INBOX", "SOMEDAY", "WAITING"].includes(String(body.planningState)) ? body.planningState as Todo["planningState"] : "SCHEDULED",
      date: text(body.date) ?? day, priority: ["HIGH", "MEDIUM", "LOW"].includes(String(body.priority)) ? body.priority as Todo["priority"] : "MEDIUM",
      workflowStatus: status, completed: status === "DONE", archived: Boolean(body.archived), createdAt: existing?.createdAt ?? timestamp(), updatedAt: timestamp(), order: existing?.order ?? todos.length,
    };
  };
  const archiveTodo = (todo: Todo) => {
    const trashId = id();
    const entry = { id: trashId, originalTodoId: todo.id, title: todo.title, deletedAt: timestamp() };
    trash.set(trashId, { entry, todo: { ...todo } });
    todos.splice(todos.indexOf(todo), 1);
    return trashId;
  };
  if (method === "PUT" && collection === "offline" && key === "todos" && action && segments.length === 3) {
    const existing = todos.find(item => item.id === action);
    if (existing) return json({ todo: existing });
    const todo = buildTodo(action);
    return todo ? json({ todo: setTodo(todo) }, 201) : bad();
  }
  if (collection === "todos") {
    if (method === "PATCH" && key === "reorder") {
      const ids = listIds(body.ids); if (!ids) return bad();
      ids.forEach((itemId, index) => { const todo = todos.find(item => item.id === itemId); if (todo) todo.order = index; });
      return ok();
    }
    if (method === "POST" && key === "bulk-trash") {
      const ids = listIds(body.ids); if (!ids) return bad();
      const selected = todos.filter(item => ids.includes(item.id));
      if (selected.some(item => todos.some(child => child.parentTodoId === item.id) || memos.some(memo => memo.todoIds.includes(item.id)) || entries.some(entry => entry.todoId === item.id) || blocks.some(block => block.todoId === item.id) || activeTimer?.todoId === item.id)) return json({ message: "연결된 Todo의 휴지통 처리는 QA에서 아직 지원하지 않습니다." }, 501);
      selected.forEach(archiveTodo); return json({ ok: true, trashed: selected.length });
    }
    if (method === "POST" && key === "bulk-update") {
      const ids = listIds(body.ids);
      const change = body.action as { type?: string; value?: unknown } | undefined;
      if (!ids || !change) return bad();
      const selected = todos.filter(item => ids.includes(item.id));
      if (change.type === "PROJECT" && (change.value !== null && !projects.some(project => project.id === change.value) || selected.some(todo => todo.parentTodoId || todos.some(child => child.parentTodoId === todo.id)))) return bad("QA 프로젝트 이동 조건을 확인하세요.");
      for (const todo of selected) {
        if (change.type === "PROJECT") todo.projectId = text(change.value);
        else if (change.type === "DATE" && typeof change.value === "string") { todo.date = change.value; todo.planningState = "SCHEDULED"; }
        else if (change.type === "WORKFLOW_STATUS" && ["TODO", "IN_PROGRESS", "BLOCKED", "DONE"].includes(String(change.value))) todo.workflowStatus = change.value as Todo["workflowStatus"];
        else if (change.type === "PRIORITY" && ["HIGH", "MEDIUM", "LOW"].includes(String(change.value))) todo.priority = change.value as Todo["priority"];
        else return bad();
        setTodo(todo);
      }
      return json({ ok: true, updated: selected.length });
    }
    if (method === "POST" && !key) { const todo = buildTodo(id()); return todo ? json({ todo: setTodo(todo) }, 201) : bad(); }
    if (key && !["reorder", "bulk-update", "bulk-trash"].includes(key)) {
      const todo = todos.find(item => item.id === key);
      if (!todo) return missing();
      if (method === "GET" && !action) return json({ todo });
      if (method === "PUT" && !action) { const next = buildTodo(key, todo); return next ? json({ todo: setTodo(next) }) : bad(); }
      if (method === "PUT" && action === "completion") {
        if (typeof body.completed !== "boolean") return bad();
        todo.workflowStatus = body.completed ? "DONE" : todo.workflowStatus === "DONE" ? "TODO" : todo.workflowStatus;
        return json({ todo: setTodo(todo) });
      }
      if (method === "POST" && action === "trash") {
        if (todos.some(child => child.parentTodoId === todo.id) || memos.some(memo => memo.todoIds.includes(todo.id)) || entries.some(entry => entry.todoId === todo.id) || blocks.some(block => block.todoId === todo.id) || activeTimer?.todoId === todo.id) return json({ message: "연결된 Todo의 휴지통 처리는 QA에서 아직 지원하지 않습니다." }, 501);
        return json({ ok: true, trashId: archiveTodo(todo) });
      }
      if (method === "PATCH" && ["archive", "unarchive"].includes(action)) { todo.archived = action === "archive"; return json({ todo: setTodo(todo) }); }
    }
  }
  if (collection === "trash" && key === "todos") {
    const item = action ? trash.get(action) : undefined;
    if (method === "GET" && !action) return json({ trashTodos: [...trash.values()].map(value => value.entry) });
    if (method === "GET" && item && segments[3] === "preview") {
      const ref = (value?: string) => ({ requested: value ?? null, restored: value ?? null });
      const count = { requested: 0, restored: 0 };
      const preview: TodoRestorePreview = { ...item.entry, originalDate: item.todo.date, restorable: !todos.some(todo => todo.id === item.todo.id), refs: { category: ref(item.todo.categoryId), project: ref(item.todo.projectId), milestone: ref(), parentTodo: ref(item.todo.parentTodoId) }, links: { children: count, memos: count, timeBlocks: count, focusSessions: count, dailyPlans: count }, warnings: ["QA 예시 데이터 복원입니다."] };
      return json({ preview });
    }
    if (method === "POST" && item && segments[3] === "restore") { if (todos.some(todo => todo.id === item.todo.id)) return bad(); setTodo(item.todo); trash.delete(item.entry.id); return json({ ok: true, todoId: item.todo.id }); }
    if (method === "DELETE") { if (action) trash.delete(action); else trash.clear(); return ok(); }
  }
  if (collection === "projects") {
    const existing = projects.find(item => item.id === key);
    if ((method === "POST" && !key) || (method === "PUT" && existing && !action)) {
      if (typeof body.name !== "string" || !body.name.trim()) return bad();
      const project: Project = { ...existing, id: existing?.id ?? id(), name: body.name.trim(), description: text(body.description), color: text(body.color), startDate: text(body.startDate), resources: Array.isArray(body.resources) ? body.resources as Project["resources"] : existing?.resources ?? [], status: ["PLANNING", "ACTIVE", "ON_HOLD", "DONE"].includes(String(body.status)) ? body.status as Project["status"] : existing?.status ?? "ACTIVE", archived: existing?.archived ?? false, order: existing?.order ?? projects.length, createdAt: existing?.createdAt ?? timestamp(), updatedAt: timestamp() };
      upsert(projects, project); return json({ project }, existing ? 200 : 201);
    }
    if (method === "PATCH" && existing && ["archive", "unarchive"].includes(action)) { existing.archived = action === "archive"; return json({ project: existing }); }
  }
  if (collection === "memos") {
    const existing = memos.find(item => item.id === key);
    if ((method === "POST" && !key) || (method === "PUT" && existing && !action)) {
      if (typeof body.content !== "string") return bad();
      const memo: Memo = { ...existing, id: existing?.id ?? id(), content: body.content, title: text(body.title), color: text(body.color), pinned: typeof body.pinned === "boolean" ? body.pinned : existing?.pinned ?? false, todoIds: existing?.todoIds ?? [], projectIds: existing?.projectIds ?? [], createdAt: existing?.createdAt ?? timestamp(), updatedAt: timestamp() };
      upsert(memos, memo); return json({ memo }, existing ? 200 : 201);
    }
    if (method === "PUT" && existing && action === "links") {
      const todoIds = listIds(body.todoIds); const projectIds = listIds(body.projectIds);
      if (!todoIds || !projectIds || todoIds.some(item => !todos.some(todo => todo.id === item)) || projectIds.some(item => !projects.some(project => project.id === item))) return bad();
      existing.todoIds = todoIds; existing.projectIds = projectIds; return json({ memo: existing });
    }
    if (method === "PATCH" && existing && action === "pin") { existing.pinned = !existing.pinned; return json({ memo: existing }); }
    if (method === "DELETE" && existing && !action) { memos.splice(memos.indexOf(existing), 1); return ok(); }
  }
  if (path === "/api/planner-settings" && ["PUT", "PATCH"].includes(method)) { settings = { ...settings, ...body }; return json({ plannerSettings: settings }); }
  if (collection === "reflections" && key === "daily" && action && method === "PUT" && typeof body.content === "string") {
    reflections.set(action, body.content); return json({ reflection: { date: action, content: body.content } });
  }
  const range = (date: string) => date >= (url.searchParams.get("from") ?? "") && date <= (url.searchParams.get("to") ?? "9999-12-31");
  const plannerDate = (ms: number) => new Date(ms + 6 * 3_600_000).toISOString().slice(0, 10);
  const makeEntries = (meta: Omit<TimeEntry, "id" | "plannerDate" | "startedAt" | "endedAt" | "durationMinutes">, start: number, end: number) => {
    const result: TimeEntry[] = [];
    while (start < end) {
      const date = plannerDate(start);
      const boundary = Date.parse(date + "T18:00:00Z");
      const stop = Math.min(end, boundary);
      if (stop <= start) break;
      result.push({ ...meta, id: id(), plannerDate: date, startedAt: new Date(start).toISOString(), endedAt: new Date(stop).toISOString(), durationMinutes: Math.max(1, Math.round((stop - start) / 60_000)) });
      start = stop;
    }
    return result;
  };
  const finishTimer = () => {
    if (!activeTimer) return [];
    const { todoTitle: title, startedAt, ...target } = activeTimer;
    const start = Date.parse(startedAt);
    const end = Math.min(now(), start + 12 * 3_600_000);
    const finished = end - start >= 30_000 ? makeEntries({ ...target, title }, start, end) : [];
    entries.push(...finished); activeTimer = null; return finished;
  };
  if (path === "/api/timer/start" && method === "POST") {
    const todo = todos.find(item => item.id === body.todoId && !item.archived);
    const project = projects.find(item => item.id === body.projectId && !item.archived);
    const category = categories.find(item => item.id === (todo ? todo.categoryId : body.categoryId));
    if (body.todoId && !todo || body.projectId && !project || !todo && !project && !category) return bad("측정 대상을 찾을 수 없습니다.");
    const target = { todoId: todo?.id, projectId: todo?.projectId ?? project?.id, categoryId: category?.id, categoryName: category?.name, todoTitle: todo?.title ?? project?.name ?? category?.name ?? "" };
    if (activeTimer && activeTimer.todoId === target.todoId && activeTimer.projectId === target.projectId && activeTimer.categoryId === target.categoryId) return json({ activeTimer, timeEntries: [], serverNow: timestamp() });
    const switchedFrom = activeTimer ?? undefined;
    const timeEntries = finishTimer();
    activeTimer = { ...target, startedAt: timestamp() };
    return json({ activeTimer, timeEntries, switchedFrom, serverNow: timestamp() });
  }
  if (path === "/api/timer/stop" && method === "POST") { const wasActive = Boolean(activeTimer); const timeEntries = finishTimer(); return json({ activeTimer: null, timeEntries, discarded: wasActive && !timeEntries.length, serverNow: timestamp() }); }
  if (collection === "time-entries" && (method === "POST" && !key || method === "PUT" && key)) {
    const start = Date.parse(String(body.startedAt)); const end = Date.parse(String(body.endedAt));
    if (!(end > start) || end - start > 24 * 3_600_000 || end > now() + 60_000) return bad("시간 범위를 확인하세요.");
    const existing = entries.find(item => item.id === key);
    if (method === "PUT" && !existing) return missing();
    if (existing && plannerDate(start) !== plannerDate(end - 1)) return bad("하루 경계를 넘기는 수정은 지원하지 않습니다.");
    const todo = todos.find(item => item.id === body.todoId);
    if (body.todoId && !todo) return missing();
    const title = todo?.title ?? text(body.title) ?? existing?.title;
    if (!title?.trim()) return bad("제목을 입력하세요.");
    const categoryId = todo?.categoryId ?? (body.categoryId === null ? undefined : text(body.categoryId) ?? existing?.categoryId);
    const category = categories.find(item => item.id === categoryId);
    if (categoryId && !category) return missing();
    const result = makeEntries({ title, todoId: todo?.id ?? existing?.todoId, projectId: todo?.projectId ?? existing?.projectId, categoryId, categoryName: category?.name }, start, end);
    if (existing) { result[0].id = existing.id; upsert(entries, result[0]); } else entries.push(...result);
    return json({ timeEntries: result }, existing ? 200 : 201);
  }
  if (collection === "time-entries" && method === "DELETE" && key) { const index = entries.findIndex(item => item.id === key); if (index >= 0) entries.splice(index, 1); return ok(); }
  if (collection === "time-blocks" && (method === "POST" && !key || method === "PUT" && key)) {
    const existing = blocks.find(item => item.id === key);
    if (method === "PUT" && !existing) return missing();
    const startTime = text(body.startTime); const endTime = text(body.endTime); const date = text(body.date); const title = text(body.title);
    const minutes = (value: string) => Number(value.slice(0, 2)) * 60 + Number(value.slice(3, 5));
    if (!startTime || !endTime || !date || !title || !(minutes(endTime) > minutes(startTime))) return bad();
    const todo = todos.find(item => item.id === body.todoId);
    if (body.todoId && !todo) return missing();
    const timeBlock: TimeBlock = { id: existing?.id ?? id(), todoId: todo?.id, title, date, startTime, endTime, plannedMinutes: minutes(endTime) - minutes(startTime), completed: Boolean(body.completed), createdAt: existing?.createdAt ?? timestamp(), updatedAt: timestamp() };
    upsert(blocks, timeBlock);
    if (todo && body.scheduleTodo) { todo.date = date; todo.planningState = "SCHEDULED"; }
    return json({ timeBlock }, existing ? 200 : 201);
  }
  if (collection === "time-blocks" && method === "DELETE" && key) { const index = blocks.findIndex(item => item.id === key); if (index >= 0) blocks.splice(index, 1); return ok(); }
  if (method === "GET" && /^\/api\/github\/repositories\/qa-example\/demo\/(issues|pulls)$/.test(path)) {
    const pull = path.endsWith("/pulls");
    const state = url.searchParams.get("state");
    const items = [{ number: pull ? 12 : 4, title: pull ? "QA 예시 Pull Request" : "QA 예시 Issue", state: "OPEN", author: "qa-example", url: "https://github.com/qa-example/demo/" + (pull ? "pull/12" : "issues/4"), updatedAt: timestamp() }];
    return json({ items: state === "closed" ? [] : items, fetchedAt: timestamp(), limited: false });
  }
  if (method !== "GET") return json({ message: "지원하지 않는 QA 수정입니다. 운영 데이터로 전송되지 않습니다." }, 501);
  const responses: Record<string, unknown> = {
    "/api/auth/session": { authenticated: true, username: "QA fixture" },
    "/api/bootstrap": { data: {} },
    "/api/categories": { categories },
    "/api/todos": { todos },
    "/api/projects": { projects },
    "/api/memos": { memos },
    "/api/milestones": { milestones: [] },
    "/api/project-decisions": { decisions: [] },
    "/api/goals": { goals: [] },
    "/api/routines": { routines: [] },
    "/api/planner-settings": { plannerSettings: settings },
    "/api/timer": { activeTimer, serverNow: timestamp() },
    "/api/time-entries": { timeEntries: entries.filter(item => range(item.plannerDate)) },
    "/api/time-summary": { byProject: [] },
    "/api/time-blocks": { timeBlocks: blocks.filter(item => range(item.date)) },
    "/api/daily-plans": { dailyPlans: [] },
    "/api/reflections": { reflections: [...reflections.entries()].filter(([date]) => range(date)).map(([date, content]) => ({ date, content })) },
    "/api/trash/todos": { trashTodos: [] },
    "/api/scratchpad": { scratchpad },
  };
  if (!Object.prototype.hasOwnProperty.call(responses, url.pathname)) return json({ message: "아직 지원하지 않는 QA 조회입니다." }, 501);
  return json(responses[url.pathname]);
};
}

export const qaFetch = createQaFetch();
