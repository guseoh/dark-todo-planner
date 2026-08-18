import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Category } from "../types/category";
import type { Todo, TodoBulkAction, TodoFilters, TodoInput } from "../types/todo";
import { api, apiAllPages, jsonBody } from "../lib/api/client";
import { getMonthGrid, getPlannerToday, getWeekDays, todayKey, toDateKey } from "../lib/date";
import {
  flushTodoMutationQueue,
  OFFLINE_TODO_SYNC_REQUEST,
  queueTodoMutation,
  shouldQueueTodoMutation,
  type QueuedTodoMutation,
} from "../lib/offlineTodoQueue";
import { calculateRate, getAllTags, priorityRank, todoOccursOnDate } from "../lib/todo";
import {
  dedupeTodosById,
  getDuplicateTodoIds,
  getOverdueIncompleteTodos as selectOverdueIncompleteTodos,
  importSelectedOverdueTodos,
  type OverdueTodoImportMode,
  type OverdueTodoImportResult,
} from "../lib/todoRecovery";

const DELETE_UNDO_MS = 6000;
const BULK_TRASH_CHUNK_SIZE = 3;

export const defaultFilters: TodoFilters = {
  query: "",
  status: "ALL",
  priority: "ALL",
  tag: "",
  categoryId: "",
  repeat: "ALL",
  archived: "ACTIVE",
  duplicatesOnly: false,
  date: "",
  sort: "DATE_ASC",
};

export type PendingTodoDelete = {
  id: string;
  label: string;
  createdAt: number;
};

const getMessage = (error: unknown) => (error instanceof Error ? error.message : "Todo 요청 처리 중 오류가 발생했습니다.");
const toTodoRequestBody = (todo: Todo | (Partial<Todo> & TodoInput)) => {
  const { id, userId, createdAt, updatedAt, category, startTime, endTime, ...body } = todo;
  void id; void userId; void createdAt; void updatedAt; void category; void startTime; void endTime;
  return body;
};

type QueueMutationInput = Pick<QueuedTodoMutation, "kind" | "method" | "path" | "body">;

const runQueueableMutation = async <T>(mutation: QueueMutationInput, request: () => Promise<T>) => {
  if (shouldQueueTodoMutation()) {
    await queueTodoMutation(mutation);
    return { queued: true as const, data: undefined };
  }
  try {
    return { queued: false as const, data: await request() };
  } catch (error) {
    if (!shouldQueueTodoMutation(error)) throw error;
    await queueTodoMutation(mutation);
    return { queued: true as const, data: undefined };
  }
};

const createOptimisticTodo = (id: string, input: TodoInput): Todo => {
  const now = new Date().toISOString();
  const planningState = input.planningState || "SCHEDULED";
  const workflowStatus = input.workflowStatus || "TODO";
  return {
    id,
    title: input.title,
    categoryId: input.categoryId,
    projectId: input.projectId,
    milestoneId: input.milestoneId,
    parentTodoId: input.parentTodoId,
    memo: input.memo,
    date: input.date || todayKey(),
    dueDate: input.dueDate,
    estimateMinutes: input.estimateMinutes,
    planningState,
    workflowStatus,
    priority: input.priority || "MEDIUM",
    completed: workflowStatus === "DONE",
    createdAt: now,
    updatedAt: now,
    repeat: input.repeat || "NONE",
    tags: input.tags || [],
    archived: false,
  };
};

const applyOptimisticUpdates = (existing: Todo, updates: Partial<Omit<Todo, "id" | "createdAt">>): Todo => {
  const next: Todo = { ...existing, ...updates, updatedAt: new Date().toISOString() };
  if (updates.workflowStatus !== undefined && updates.completed === undefined) next.completed = updates.workflowStatus === "DONE";
  if (updates.completed !== undefined && updates.workflowStatus === undefined) {
    next.workflowStatus = updates.completed ? "DONE" : existing.workflowStatus === "DONE" ? "TODO" : existing.workflowStatus;
  }
  if (updates.archived === true && !existing.archived) next.archivedAt = next.updatedAt;
  if (updates.archived === false) next.archivedAt = undefined;
  if (updates.categoryId !== undefined && updates.categoryId !== existing.categoryId) next.category = undefined;
  return next;
};

export function useTodos() {
  const [allTodos, setAllTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [pendingDelete, setPendingDelete] = useState<PendingTodoDelete | null>(null);
  const deleteTimersRef = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const deletedSnapshotsRef = useRef(new Map<string, Todo>());

  const loadTodos = useCallback(async () => {
    setLoading(true);
    try {
      const pendingIds = new Set(deletedSnapshotsRef.current.keys());
      const loaded = dedupeTodosById(await apiAllPages<Todo>("/api/todos?archived=all", "todos"))
        .filter((todo) => !pendingIds.has(todo.id))
        .map((todo) => ({
          ...todo,
          planningState: todo.planningState || "SCHEDULED",
          workflowStatus: todo.workflowStatus || (todo.completed ? "DONE" : "TODO"),
        }));
      setAllTodos(loaded);
      setError("");
      return loaded;
    } catch (err) {
      setError(getMessage(err));
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    let syncing = false;
    const sync = async () => {
      if (syncing) return;
      syncing = true;
      try {
        const result = await flushTodoMutationQueue();
        if (active && result.flushed > 0) await loadTodos();
      } catch {
        // Queue state is surfaced by OfflineSyncIndicator. Keep queued mutations intact.
      } finally {
        syncing = false;
      }
    };
    const handleSyncRequest = () => { void sync(); };
    window.addEventListener(OFFLINE_TODO_SYNC_REQUEST, handleSyncRequest);
    if (navigator.onLine) void sync();
    return () => {
      active = false;
      window.removeEventListener(OFFLINE_TODO_SYNC_REQUEST, handleSyncRequest);
    };
  }, [loadTodos]);

  const todos = useMemo(() => allTodos.filter((todo) => !todo.archived), [allTodos]);
  const archivedTodos = useMemo(() => allTodos.filter((todo) => todo.archived), [allTodos]);
  const inboxTodos = useMemo(() => todos.filter((todo) => todo.planningState === "INBOX"), [todos]);
  const tagOptions = useMemo(() => getAllTags(allTodos), [allTodos]);
  const duplicateTodoIds = useMemo(() => getDuplicateTodoIds(allTodos), [allTodos]);

  const addTodo = useCallback(async (input: TodoInput) => {
    setSaving(true);
    try {
      const clientId = crypto.randomUUID();
      const optimistic = createOptimisticTodo(clientId, input);
      const body = toTodoRequestBody(optimistic);
      const mutation: QueueMutationInput = { kind: "CREATE", method: "PUT", path: `/api/offline/todos/${clientId}`, body };
      const result = await runQueueableMutation<{ todo: Todo }>(mutation, () => api<{ todo: Todo }>(mutation.path, { method: "PUT", ...jsonBody(body) }));
      const todo = result.queued ? optimistic : result.data!.todo;
      setAllTodos((current) => [todo, ...current.filter((item) => item.id !== todo.id)]);
      setError("");
      return todo;
    } catch (err) {
      setError(getMessage(err));
      return undefined;
    } finally {
      setSaving(false);
    }
  }, []);

  const updateTodo = useCallback(async (id: string, updates: Partial<Omit<Todo, "id" | "createdAt">>) => {
    const existing = allTodos.find((todo) => todo.id === id);
    if (!existing) return undefined;
    setSaving(true);
    try {
      const optimistic = applyOptimisticUpdates(existing, updates);
      const body = toTodoRequestBody(optimistic);
      const mutation: QueueMutationInput = { kind: "UPDATE", method: "PUT", path: `/api/todos/${id}`, body };
      const result = await runQueueableMutation<{ todo: Todo }>(mutation, () => api<{ todo: Todo }>(mutation.path, { method: "PUT", ...jsonBody(body) }));
      const todo = result.queued ? optimistic : result.data!.todo;
      setAllTodos((current) => current.map((item) => (item.id === id ? todo : item)));
      setError("");
      return todo;
    } catch (err) {
      setError(getMessage(err));
      return undefined;
    } finally {
      setSaving(false);
    }
  }, [allTodos]);

  const finalizeDelete = useCallback(async (id: string) => {
    const snapshot = deletedSnapshotsRef.current.get(id);
    try {
      const mutation: QueueMutationInput = { kind: "TRASH", method: "POST", path: `/api/todos/${id}/trash` };
      await runQueueableMutation(mutation, () => api(mutation.path, { method: "POST" }));
      deletedSnapshotsRef.current.delete(id);
      setError("");
    } catch (err) {
      if (snapshot) setAllTodos((current) => current.some((todo) => todo.id === id) ? current : [snapshot, ...current]);
      setError(getMessage(err));
    } finally {
      deleteTimersRef.current.delete(id);
      setPendingDelete((current) => (current?.id === id ? null : current));
    }
  }, []);

  const deleteTodo = useCallback((id: string) => {
    const todo = allTodos.find((item) => item.id === id);
    if (!todo) return;
    const existingTimer = deleteTimersRef.current.get(id);
    if (existingTimer) clearTimeout(existingTimer);
    deletedSnapshotsRef.current.set(id, todo);
    setAllTodos((current) => current.filter((item) => item.id !== id));
    setPendingDelete({ id, label: todo.title, createdAt: Date.now() });
    const timer = setTimeout(() => void finalizeDelete(id), DELETE_UNDO_MS);
    deleteTimersRef.current.set(id, timer);
  }, [allTodos, finalizeDelete]);

  const undoDeleteTodo = useCallback(() => {
    const pending = pendingDelete;
    if (!pending) return;
    const timer = deleteTimersRef.current.get(pending.id);
    if (timer) clearTimeout(timer);
    deleteTimersRef.current.delete(pending.id);
    const snapshot = deletedSnapshotsRef.current.get(pending.id);
    deletedSnapshotsRef.current.delete(pending.id);
    if (snapshot) setAllTodos((current) => current.some((todo) => todo.id === snapshot.id) ? current : [snapshot, ...current]);
    setPendingDelete(null);
  }, [pendingDelete]);

  const deleteTodos = useCallback(async (ids: string[]) => {
    const uniqueIds = Array.from(new Set(ids.map((id) => id.trim()).filter(Boolean)));
    if (!uniqueIds.length) return true;
    for (const id of uniqueIds) {
      const timer = deleteTimersRef.current.get(id);
      if (timer) clearTimeout(timer);
      deleteTimersRef.current.delete(id);
      deletedSnapshotsRef.current.delete(id);
    }
    setPendingDelete((current) => current && uniqueIds.includes(current.id) ? null : current);
    const previous = allTodos;
    const targetIds = new Set(uniqueIds);
    setAllTodos((current) => current.filter((todo) => !targetIds.has(todo.id)));
    setSaving(true);
    try {
      for (let index = 0; index < uniqueIds.length; index += BULK_TRASH_CHUNK_SIZE) {
        const chunk = uniqueIds.slice(index, index + BULK_TRASH_CHUNK_SIZE);
        const body = { ids: chunk };
        const mutation: QueueMutationInput = { kind: "BULK_TRASH", method: "POST", path: "/api/todos/bulk-trash", body };
        await runQueueableMutation(mutation, () => api(mutation.path, { method: "POST", ...jsonBody(body) }));
      }
      setError("");
      return true;
    } catch (err) {
      try {
        await loadTodos();
      } catch {
        setAllTodos(previous);
      }
      setError(getMessage(err));
      return false;
    } finally {
      setSaving(false);
    }
  }, [allTodos, loadTodos]);

  const bulkUpdateTodos = useCallback(async (ids: string[], action: TodoBulkAction) => {
    const uniqueIds = Array.from(new Set(ids.map((id) => id.trim()).filter(Boolean)));
    if (!uniqueIds.length) return true;
    const previous = allTodos;
    const targetIds = new Set(uniqueIds);
    setAllTodos((current) => current.map((todo) => {
      if (!targetIds.has(todo.id)) return todo;
      if (action.type === "PROJECT") return { ...todo, projectId: action.value || undefined, milestoneId: undefined, parentTodoId: undefined, updatedAt: new Date().toISOString() };
      if (action.type === "DATE") return { ...todo, date: action.value, planningState: "SCHEDULED", updatedAt: new Date().toISOString() };
      if (action.type === "WORKFLOW_STATUS") return { ...todo, workflowStatus: action.value, completed: action.value === "DONE", updatedAt: new Date().toISOString() };
      return { ...todo, priority: action.value, updatedAt: new Date().toISOString() };
    }));
    setSaving(true);
    try {
      const body = { ids: uniqueIds, action };
      const mutation: QueueMutationInput = { kind: "BULK_UPDATE", method: "POST", path: "/api/todos/bulk-update", body };
      await runQueueableMutation(mutation, () => api(mutation.path, { method: "POST", ...jsonBody(body) }));
      setError("");
      return true;
    } catch (err) {
      setAllTodos(previous);
      setError(getMessage(err));
      return false;
    } finally {
      setSaving(false);
    }
  }, [allTodos]);

  const toggleTodo = useCallback(async (id: string) => {
    const existing = allTodos.find((todo) => todo.id === id);
    if (!existing) return false;

    const completed = !existing.completed;
    const workflowStatus = completed ? "DONE" as const : "TODO" as const;
    const optimistic = applyOptimisticUpdates(existing, { completed, workflowStatus });
    setAllTodos((current) => current.map((todo) => (todo.id === id ? optimistic : todo)));
    setSaving(true);

    try {
      const body = { completed };
      const mutation: QueueMutationInput = { kind: "UPDATE", method: "PUT", path: `/api/todos/${id}/completion`, body };
      await runQueueableMutation(mutation, () => api(mutation.path, { method: "PUT", ...jsonBody(body) }));
      setError("");
      return true;
    } catch (err) {
      setAllTodos((current) => current.map((todo) => {
        if (todo.id !== id || todo.completed !== completed) return todo;
        return {
          ...todo,
          completed: existing.completed,
          workflowStatus: existing.workflowStatus,
          updatedAt: existing.updatedAt,
        };
      }));
      setError(getMessage(err));
      return false;
    } finally {
      setSaving(false);
    }
  }, [allTodos]);

  const archiveTodo = useCallback(async (id: string) => {
    await updateTodo(id, { archived: true });
  }, [updateTodo]);

  const unarchiveTodo = useCallback(async (id: string) => {
    await updateTodo(id, { archived: false });
  }, [updateTodo]);

  const syncCategory = useCallback((category: Category) => {
    setAllTodos((current) => current.map((todo) => (todo.categoryId === category.id ? { ...todo, category } : todo)));
  }, []);

  const removeCategoryFromTodos = useCallback((categoryId: string, mode: "moveTodos" | "deleteTodos" = "moveTodos") => {
    setAllTodos((current) => mode === "deleteTodos"
      ? current.filter((todo) => todo.categoryId !== categoryId)
      : current.map((todo) => todo.categoryId === categoryId ? { ...todo, categoryId: undefined, category: undefined } : todo));
  }, []);

  const getTodosByDate = useCallback((date: string) => todos.filter((todo) => todoOccursOnDate(todo, date)), [todos]);
  const getTodayTodos = useCallback(() => getTodosByDate(todayKey()), [getTodosByDate]);
  const getOverdueIncompleteTodos = useCallback(() => selectOverdueIncompleteTodos(todos, getPlannerToday()), [todos]);
  const getWeekTodos = useCallback(() => {
    const days = getWeekDays().map(toDateKey);
    return todos.filter((todo) => days.some((day) => todoOccursOnDate(todo, day)));
  }, [todos]);

  const bringOverdueTodosToToday = useCallback(async (selectedIds: ReadonlySet<string>, mode: OverdueTodoImportMode): Promise<OverdueTodoImportResult> => {
    const today = getPlannerToday();
    return importSelectedOverdueTodos({
      overdueTodos: getOverdueIncompleteTodos(), selectedIds, todayTodos: getTodosByDate(today), mode,
      copyTodo: async (todo) => Boolean(await addTodo({
        title: todo.title, memo: todo.memo, categoryId: todo.categoryId, projectId: todo.projectId, milestoneId: todo.milestoneId,
        date: today, dueDate: todo.dueDate, estimateMinutes: todo.estimateMinutes, planningState: "SCHEDULED", priority: todo.priority, repeat: todo.repeat, tags: todo.tags,
      })),
      moveTodo: async (todo) => Boolean(await updateTodo(todo.id, { date: today, planningState: "SCHEDULED" })),
    });
  }, [addTodo, getOverdueIncompleteTodos, getTodosByDate, updateTodo]);

  const getMonthTodos = useCallback(() => {
    const days = getMonthGrid().map(toDateKey);
    return todos.filter((todo) => days.some((day) => todoOccursOnDate(todo, day)));
  }, [todos]);

  const filterTodos = useCallback((filters: TodoFilters) => {
    let result = filters.archived === "ARCHIVED" ? archivedTodos : filters.archived === "ALL" ? allTodos : todos;
    const keyword = filters.query.trim().toLowerCase();
    if (keyword) result = result.filter((todo) => `${todo.title} ${todo.memo || ""} ${(todo.tags || []).join(" ")} ${todo.category?.name || ""}`.toLowerCase().includes(keyword));
    if (filters.status === "ACTIVE") result = result.filter((todo) => !todo.completed);
    if (filters.status === "COMPLETED") result = result.filter((todo) => todo.completed);
    if (filters.priority !== "ALL") result = result.filter((todo) => todo.priority === filters.priority);
    if (filters.tag) result = result.filter((todo) => todo.tags.includes(filters.tag));
    if (filters.categoryId === "uncategorized") result = result.filter((todo) => !todo.categoryId);
    else if (filters.categoryId) result = result.filter((todo) => todo.categoryId === filters.categoryId);
    if (filters.repeat !== "ALL") result = result.filter((todo) => todo.repeat === filters.repeat);
    if (filters.duplicatesOnly) result = result.filter((todo) => duplicateTodoIds.has(todo.id));
    if (filters.date) result = result.filter((todo) => todoOccursOnDate(todo, filters.date));
    return [...result].sort((a, b) => {
      if (filters.sort === "OLDEST") return a.createdAt.localeCompare(b.createdAt);
      if (filters.sort === "PRIORITY") return priorityRank[b.priority] - priorityRank[a.priority];
      if (filters.sort === "DATE_ASC") return a.date.localeCompare(b.date);
      return b.createdAt.localeCompare(a.createdAt);
    });
  }, [allTodos, archivedTodos, duplicateTodoIds, todos]);

  const stats = useMemo(() => {
    const todayTodos = getTodayTodos(); const weekTodos = getWeekTodos(); const monthTodos = getMonthTodos();
    return {
      todayTotal: todayTodos.length, todayCompleted: todayTodos.filter((todo) => todo.completed).length, todayActive: todayTodos.filter((todo) => !todo.completed).length,
      todayRate: calculateRate(todayTodos), weekTotal: weekTodos.length, weekRate: calculateRate(weekTodos), monthTotal: monthTodos.length,
      total: todos.length, completedTotal: todos.filter((todo) => todo.completed).length, archivedTotal: archivedTodos.length, inboxTotal: inboxTodos.length,
    };
  }, [archivedTodos.length, getMonthTodos, getTodayTodos, getWeekTodos, inboxTodos.length, todos]);

  return {
    allTodos, todos, archivedTodos, inboxTodos, tagOptions, duplicateTodoIds, stats, loading, saving, error, pendingDelete,
    loadTodos, addTodo, updateTodo, deleteTodo, undoDeleteTodo, deleteTodos, bulkUpdateTodos, toggleTodo, archiveTodo, unarchiveTodo,
    syncCategory, removeCategoryFromTodos, getTodosByDate, getTodayTodos, getOverdueIncompleteTodos, getWeekTodos, getMonthTodos, filterTodos, bringOverdueTodosToToday,
  };
}
