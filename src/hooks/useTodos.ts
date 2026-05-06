import { useCallback, useMemo, useState } from "react";
import type { Category } from "../types/category";
import type { Todo, TodoFilters, TodoInput } from "../types/todo";
import { api, jsonBody } from "../lib/api/client";
import { getMonthGrid, getWeekDays, todayKey, toDateKey } from "../lib/date";
import { calculateRate, getAllTags, priorityRank, todoOccursOnDate } from "../lib/todo";

export const defaultFilters: TodoFilters = {
  query: "",
  status: "ALL",
  priority: "ALL",
  tag: "",
  categoryId: "",
  repeat: "ALL",
  archived: "ACTIVE",
  date: "",
  sort: "DATE_ASC",
};

const getMessage = (error: unknown) => (error instanceof Error ? error.message : "Todo 요청 처리 중 오류가 발생했습니다.");

const toTodoRequestBody = (todo: Todo | (Partial<Todo> & TodoInput)) => {
  const { id, userId, createdAt, updatedAt, category, startTime, endTime, ...body } = todo;
  void id;
  void userId;
  void createdAt;
  void updatedAt;
  void category;
  void startTime;
  void endTime;
  return body;
};

export function useTodos() {
  const [allTodos, setAllTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const loadTodos = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api<{ todos: Todo[] }>("/api/todos?archived=all");
      setAllTodos(result.todos);
      setError("");
      return result.todos;
    } catch (err) {
      const message = getMessage(err);
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const todos = useMemo(() => allTodos.filter((todo) => !todo.archived), [allTodos]);
  const archivedTodos = useMemo(() => allTodos.filter((todo) => todo.archived), [allTodos]);
  const tagOptions = useMemo(() => getAllTags(allTodos), [allTodos]);

  const addTodo = useCallback(async (input: TodoInput) => {
    setSaving(true);
    try {
      const result = await api<{ todo: Todo }>("/api/todos", {
        method: "POST",
        ...jsonBody(toTodoRequestBody({ date: todayKey(), priority: "MEDIUM", repeat: "NONE", ...input })),
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
      setAllTodos((current) => current.map((todo) => (todo.id === id ? result.todo : todo)));
      setError("");
      return result.todo;
    } catch (err) {
      setError(getMessage(err));
      return undefined;
    } finally {
      setSaving(false);
    }
  }, [allTodos]);

  const deleteTodo = useCallback(async (id: string) => {
    const previous = allTodos;
    setAllTodos((current) => current.filter((todo) => todo.id !== id));
    try {
      await api(`/api/todos/${id}`, { method: "DELETE" });
      setError("");
    } catch (err) {
      setAllTodos(previous);
      setError(getMessage(err));
    }
  }, [allTodos]);

  const toggleTodo = useCallback(async (id: string) => {
    const previous = allTodos;
    setAllTodos((current) => current.map((todo) => (todo.id === id ? { ...todo, completed: !todo.completed } : todo)));
    try {
      const result = await api<{ todo: Todo }>(`/api/todos/${id}/toggle`, { method: "PATCH" });
      setAllTodos((current) => current.map((todo) => (todo.id === id ? result.todo : todo)));
      setError("");
    } catch (err) {
      setAllTodos(previous);
      setError(getMessage(err));
    }
  }, [allTodos]);

  const archiveTodo = useCallback(async (id: string) => {
    try {
      const result = await api<{ todo: Todo }>(`/api/todos/${id}/archive`, { method: "PATCH" });
      setAllTodos((current) => current.map((todo) => (todo.id === id ? result.todo : todo)));
      setError("");
    } catch (err) {
      setError(getMessage(err));
    }
  }, []);

  const unarchiveTodo = useCallback(async (id: string) => {
    try {
      const result = await api<{ todo: Todo }>(`/api/todos/${id}/unarchive`, { method: "PATCH" });
      setAllTodos((current) => current.map((todo) => (todo.id === id ? result.todo : todo)));
      setError("");
    } catch (err) {
      setError(getMessage(err));
    }
  }, []);

  const syncCategory = useCallback((category: Category) => {
    setAllTodos((current) => current.map((todo) => (todo.categoryId === category.id ? { ...todo, category } : todo)));
  }, []);

  const removeCategoryFromTodos = useCallback((categoryId: string, mode: "moveTodos" | "deleteTodos" = "moveTodos") => {
    setAllTodos((current) =>
      mode === "deleteTodos"
        ? current.filter((todo) => todo.categoryId !== categoryId)
        : current.map((todo) => (todo.categoryId === categoryId ? { ...todo, categoryId: undefined, category: undefined } : todo)),
    );
  }, []);

  const getTodosByDate = useCallback((date: string) => todos.filter((todo) => todoOccursOnDate(todo, date)), [todos]);
  const getTodayTodos = useCallback(() => getTodosByDate(todayKey()), [getTodosByDate]);
  const getWeekTodos = useCallback(() => {
    const days = getWeekDays().map(toDateKey);
    return todos.filter((todo) => days.some((day) => todoOccursOnDate(todo, day)));
  }, [todos]);
  const getMonthTodos = useCallback(() => {
    const days = getMonthGrid().map(toDateKey);
    return todos.filter((todo) => days.some((day) => todoOccursOnDate(todo, day)));
  }, [todos]);

  const filterTodos = useCallback((filters: TodoFilters) => {
    let result = filters.archived === "ARCHIVED" ? archivedTodos : filters.archived === "ALL" ? allTodos : todos;
    const keyword = filters.query.trim().toLowerCase();
    if (keyword) {
      result = result.filter((todo) =>
        `${todo.title} ${todo.memo || ""} ${(todo.tags || []).join(" ")} ${todo.category?.name || ""}`.toLowerCase().includes(keyword),
      );
    }
    if (filters.status === "ACTIVE") result = result.filter((todo) => !todo.completed);
    if (filters.status === "COMPLETED") result = result.filter((todo) => todo.completed);
    if (filters.priority !== "ALL") result = result.filter((todo) => todo.priority === filters.priority);
    if (filters.tag) result = result.filter((todo) => todo.tags.includes(filters.tag));
    if (filters.categoryId === "uncategorized") result = result.filter((todo) => !todo.categoryId);
    else if (filters.categoryId) result = result.filter((todo) => todo.categoryId === filters.categoryId);
    if (filters.repeat !== "ALL") result = result.filter((todo) => todo.repeat === filters.repeat);
    if (filters.date) result = result.filter((todo) => todoOccursOnDate(todo, filters.date));

    return [...result].sort((a, b) => {
      if (filters.sort === "OLDEST") return a.createdAt.localeCompare(b.createdAt);
      if (filters.sort === "PRIORITY") return priorityRank[b.priority] - priorityRank[a.priority];
      if (filters.sort === "DATE_ASC") return a.date.localeCompare(b.date);
      return b.createdAt.localeCompare(a.createdAt);
    });
  }, [allTodos, archivedTodos, todos]);

  const stats = useMemo(() => {
    const todayTodos = getTodayTodos();
    const weekTodos = getWeekTodos();
    const monthTodos = getMonthTodos();
    return {
      todayTotal: todayTodos.length,
      todayCompleted: todayTodos.filter((todo) => todo.completed).length,
      todayActive: todayTodos.filter((todo) => !todo.completed).length,
      todayRate: calculateRate(todayTodos),
      weekRate: calculateRate(weekTodos),
      monthTotal: monthTodos.length,
      total: todos.length,
      completedTotal: todos.filter((todo) => todo.completed).length,
      archivedTotal: archivedTodos.length,
    };
  }, [archivedTodos.length, getMonthTodos, getTodayTodos, getWeekTodos, todos]);

  return {
    allTodos,
    todos,
    archivedTodos,
    tagOptions,
    stats,
    loading,
    saving,
    error,
    loadTodos,
    addTodo,
    updateTodo,
    deleteTodo,
    toggleTodo,
    archiveTodo,
    unarchiveTodo,
    syncCategory,
    removeCategoryFromTodos,
    getTodosByDate,
    getTodayTodos,
    getWeekTodos,
    getMonthTodos,
    filterTodos,
  };
}
