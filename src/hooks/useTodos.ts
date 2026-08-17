import { useCallback, useMemo, useRef, useState } from "react";
import type { Category } from "../types/category";
import type { Todo, TodoBulkAction, TodoFilters, TodoInput } from "../types/todo";
import { api, apiAllPages, jsonBody } from "../lib/api/client";
import { getMonthGrid, getPlannerToday, getWeekDays, todayKey, toDateKey } from "../lib/date";
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

  const syncDependents = useCallback(async (ids: string[]) => {
    for (const id of Array.from(new Set(ids))) await api(`/api/todos/${id}/dependents/sync`, { method: "POST" });
  }, []);

  const todos = useMemo(() => allTodos.filter((todo) => !todo.archived), [allTodos]);
  const archivedTodos = useMemo(() => allTodos.filter((todo) => todo.archived), [allTodos]);
  const inboxTodos = useMemo(() => todos.filter((todo) => todo.planningState === "INBOX"), [todos]);
  const tagOptions = useMemo(() => getAllTags(allTodos), [allTodos]);
  const duplicateTodoIds = useMemo(() => getDuplicateTodoIds(allTodos), [allTodos]);

  const addTodo = useCallback(async (input: TodoInput) => {
    setSaving(true);
    try {
      const result = await api<{ todo: Todo }>("/api/todos", {
        method: "POST",
        ...jsonBody(toTodoRequestBody({
          date: todayKey(), priority: "MEDIUM", repeat: "NONE", planningState: "SCHEDULED", workflowStatus: "TODO", ...input,
        })),
      });
      setAllTodos((current) => [result.todo, ...current]);
      setError("");
      return result.todo;
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
      const result = await api<{ todo: Todo }>(`/api/todos/${id}`, {
        method: "PUT",
        ...jsonBody(toTodoRequestBody({ ...existing, ...updates })),
      });
      const statusChanged = existing.completed !== result.todo.completed || existing.workflowStatus !== result.todo.workflowStatus;
      if (statusChanged) {
        await syncDependents([id]);
        const loaded = await loadTodos();
        setError("");
        return loaded.find((todo) => todo.id === id) || result.todo;
      }
      setAllTodos((current) => current.map((todo) => (todo.id === id ? result.todo : todo)));
      setError("");
      return result.todo;
    } catch (err) {
      setError(getMessage(err));
      return undefined;
    } finally {
      setSaving(false);
    }
  }, [allTodos, loadTodos, syncDependents]);

  const finalizeDelete = useCallback(async (id: string) => {
    const snapshot = deletedSnapshotsRef.current.get(id);
    try {
      await api(`/api/todos/${id}/trash`, { method: "POST" });
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
        await api("/api/todos/bulk-trash", { method: "POST", ...jsonBody({ ids: chunk }) });
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
      if (action.type === "PROJECT") return { ...todo, projectId: action.value || undefined, milestoneId: undefined, parentTodoId: undefined };
      if (action.type === "DATE") return { ...todo, date: action.value, planningState: "SCHEDULED" };
      if (action.type === "WORKFLOW_STATUS") return { ...todo, workflowStatus: action.value, completed: action.value === "DONE" };
      return { ...todo, priority: action.value };
    }));
    setSaving(true);
    try {
      await api("/api/todos/bulk-update", { method: "POST", ...jsonBody({ ids: uniqueIds, action }) });
      if (action.type === "WORKFLOW_STATUS") {
        await syncDependents(uniqueIds);
        await loadTodos();
      }
      setError("");
      return true;
    } catch (err) {
      setAllTodos(previous);
      setError(getMessage(err));
      return false;
    } finally {
      setSaving(false);
    }
  }, [allTodos, loadTodos, syncDependents]);

  const toggleTodo = useCallback(async (id: string) => {
    const previous = allTodos;
    setAllTodos((current) => current.map((todo) => todo.id === id ? { ...todo, completed: !todo.completed, workflowStatus: !todo.completed ? "DONE" : todo.workflowStatus === "DONE" ? "TODO" : todo.workflowStatus } : todo));
    try {
      await api<{ todo: Todo }>(`/api/todos/${id}/toggle`, { method: "PATCH" });
      await syncDependents([id]);
      await loadTodos();
      setError("");
    } catch (err) {
      setAllTodos(previous);
      setError(getMessage(err));
    }
  }, [allTodos, loadTodos, syncDependents]);

  const archiveTodo = useCallback(async (id: string) => {
    try {
      const result = await api<{ todo: Todo }>(`/api/todos/${id}/archive`, { method: "PATCH" });
      setAllTodos((current) => current.map((todo) => (todo.id === id ? result.todo : todo)));
      setError("");
    } catch (err) { setError(getMessage(err)); }
  }, []);

  const unarchiveTodo = useCallback(async (id: string) => {
    try {
      const result = await api<{ todo: Todo }>(`/api/todos/${id}/unarchive`, { method: "PATCH" });
      setAllTodos((current) => current.map((todo) => (todo.id === id ? result.todo : todo)));
      setError("");
    } catch (err) { setError(getMessage(err)); }
  }, []);

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
