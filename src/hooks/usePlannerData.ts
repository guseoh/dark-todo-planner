import { useCallback, useEffect, useMemo, useState } from "react";
import type { Category } from "../types/category";
import type { FocusSession, TimerSettings } from "../types/timer";
import { DEFAULT_TIMER_SETTINGS } from "../types/timer";
import type { Goal } from "../types/goal";
import type { Reflection } from "../types/reflection";
import type { Todo, TodoFilters, TodoInput } from "../types/todo";
import { api, jsonBody } from "../lib/api/client";
import { getMonthGrid, getMonthRange, getWeekDays, getWeekRange, isDateKeyInRange, todayKey, toDateKey } from "../lib/date";
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

const getMessage = (error: unknown) => (error instanceof Error ? error.message : "요청 처리 중 오류가 발생했습니다.");

export function usePlannerData() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [allTodos, setAllTodos] = useState<Todo[]>([]);
  const [reflections, setReflections] = useState<Reflection[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [focusSessions, setFocusSessions] = useState<FocusSession[]>([]);
  const [timerSettings, setTimerSettings] = useState<TimerSettings>(DEFAULT_TIMER_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [categoryResult, todoResult, reflectionResult, goalResult, sessionResult, timerResult] = await Promise.all([
        api<{ categories: Category[] }>("/api/categories"),
        api<{ todos: Todo[] }>("/api/todos?archived=all"),
        api<{ reflections: Reflection[] }>("/api/reflections"),
        api<{ goals: Goal[] }>("/api/goals"),
        api<{ focusSessions: FocusSession[] }>("/api/focus-sessions"),
        api<{ timerSettings: TimerSettings }>("/api/timer-settings"),
      ]);
      setCategories(categoryResult.categories);
      setAllTodos(todoResult.todos);
      setReflections(reflectionResult.reflections);
      setGoals(goalResult.goals);
      setFocusSessions(sessionResult.focusSessions);
      setTimerSettings(timerResult.timerSettings);
      setError("");
    } catch (err) {
      setError(getMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const todos = useMemo(() => allTodos.filter((todo) => !todo.archived), [allTodos]);
  const archivedTodos = useMemo(() => allTodos.filter((todo) => todo.archived), [allTodos]);
  const tagOptions = useMemo(() => getAllTags(allTodos), [allTodos]);

  const addTodo = useCallback(async (input: TodoInput) => {
    setSaving(true);
    try {
      const result = await api<{ todo: Todo }>("/api/todos", {
        method: "POST",
        ...jsonBody({ date: todayKey(), priority: "MEDIUM", repeat: "NONE", ...input }),
      });
      setAllTodos((current) => [result.todo, ...current]);
      setError("");
    } catch (err) {
      setError(getMessage(err));
    } finally {
      setSaving(false);
    }
  }, []);

  const updateTodo = useCallback(async (id: string, updates: Partial<Omit<Todo, "id" | "createdAt">>) => {
    const existing = allTodos.find((todo) => todo.id === id);
    if (!existing) return;
    setSaving(true);
    try {
      const result = await api<{ todo: Todo }>(`/api/todos/${id}`, {
        method: "PUT",
        ...jsonBody({ ...existing, ...updates }),
      });
      setAllTodos((current) => current.map((todo) => (todo.id === id ? result.todo : todo)));
      setError("");
    } catch (err) {
      setError(getMessage(err));
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
    const result = await api<{ todo: Todo }>(`/api/todos/${id}/archive`, { method: "PATCH" });
    setAllTodos((current) => current.map((todo) => (todo.id === id ? result.todo : todo)));
  }, []);

  const unarchiveTodo = useCallback(async (id: string) => {
    const result = await api<{ todo: Todo }>(`/api/todos/${id}/unarchive`, { method: "PATCH" });
    setAllTodos((current) => current.map((todo) => (todo.id === id ? result.todo : todo)));
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

  const addCategory = useCallback(async (input: { name: string; description?: string; color?: string }) => {
    const result = await api<{ category: Category }>("/api/categories", { method: "POST", ...jsonBody(input) });
    setCategories((current) => [...current, result.category]);
  }, []);

  const updateCategory = useCallback(async (id: string, input: Partial<Category>) => {
    const existing = categories.find((category) => category.id === id);
    if (!existing) return;
    const result = await api<{ category: Category }>(`/api/categories/${id}`, { method: "PUT", ...jsonBody({ ...existing, ...input }) });
    setCategories((current) => current.map((category) => (category.id === id ? result.category : category)));
    setAllTodos((current) => current.map((todo) => (todo.categoryId === id ? { ...todo, category: result.category } : todo)));
  }, [categories]);

  const deleteCategory = useCallback(async (id: string, mode: "moveTodos" | "deleteTodos") => {
    await api(`/api/categories/${id}?mode=${mode}`, { method: "DELETE" });
    setCategories((current) => current.filter((category) => category.id !== id));
    setAllTodos((current) =>
      mode === "deleteTodos"
        ? current.filter((todo) => todo.categoryId !== id)
        : current.map((todo) => (todo.categoryId === id ? { ...todo, categoryId: undefined, category: undefined } : todo)),
    );
  }, []);

  const addReflection = useCallback(async (input: Omit<Reflection, "id" | "createdAt" | "updatedAt">) => {
    const result = await api<{ reflection: Reflection }>("/api/reflections", { method: "POST", ...jsonBody(input) });
    setReflections((current) => [result.reflection, ...current]);
  }, []);

  const updateReflection = useCallback(async (id: string, input: Partial<Reflection>) => {
    const existing = reflections.find((reflection) => reflection.id === id);
    if (!existing) return;
    const result = await api<{ reflection: Reflection }>(`/api/reflections/${id}`, { method: "PUT", ...jsonBody({ ...existing, ...input }) });
    setReflections((current) => current.map((reflection) => (reflection.id === id ? result.reflection : reflection)));
  }, [reflections]);

  const deleteReflection = useCallback(async (id: string) => {
    await api(`/api/reflections/${id}`, { method: "DELETE" });
    setReflections((current) => current.filter((reflection) => reflection.id !== id));
  }, []);

  const addGoal = useCallback(async (input: Partial<Goal> & { title: string }) => {
    const result = await api<{ goal: Goal }>("/api/goals", { method: "POST", ...jsonBody(input) });
    setGoals((current) => [result.goal, ...current]);
  }, []);

  const updateGoal = useCallback(async (id: string, input: Partial<Goal>) => {
    const existing = goals.find((goal) => goal.id === id);
    if (!existing) return;
    const result = await api<{ goal: Goal }>(`/api/goals/${id}`, { method: "PUT", ...jsonBody({ ...existing, ...input }) });
    setGoals((current) => current.map((goal) => (goal.id === id ? result.goal : goal)));
  }, [goals]);

  const toggleGoal = useCallback(async (id: string) => {
    const result = await api<{ goal: Goal }>(`/api/goals/${id}/toggle`, { method: "PATCH" });
    setGoals((current) => current.map((goal) => (goal.id === id ? result.goal : goal)));
  }, []);

  const deleteGoal = useCallback(async (id: string) => {
    await api(`/api/goals/${id}`, { method: "DELETE" });
    setGoals((current) => current.filter((goal) => goal.id !== id));
  }, []);

  const addFocusSession = useCallback(async (input: Omit<FocusSession, "id">) => {
    const result = await api<{ focusSession: FocusSession }>("/api/focus-sessions", { method: "POST", ...jsonBody(input) });
    setFocusSessions((current) => [result.focusSession, ...current]);
  }, []);

  const updateTimerSettings = useCallback(async (input: Partial<TimerSettings>) => {
    const next = { ...timerSettings, ...input };
    setTimerSettings(next);
    const result = await api<{ timerSettings: TimerSettings }>("/api/timer-settings", { method: "PUT", ...jsonBody(next) });
    setTimerSettings(result.timerSettings);
  }, [timerSettings]);

  const exportBackup = useCallback(() => api<Record<string, unknown>>("/api/backup/export"), []);
  const importBackup = useCallback(async (data: unknown) => {
    await api("/api/backup/import", { method: "POST", ...jsonBody(data) });
    await loadAll();
  }, [loadAll]);
  const migrateLocalStorage = useCallback(async (data: unknown) => {
    await api("/api/migrate/local-storage", { method: "POST", ...jsonBody(data) });
    await loadAll();
  }, [loadAll]);

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

  const focusStats = useMemo(() => {
    const focus = focusSessions.filter((session) => session.mode === "FOCUS" && session.completed);
    const week = getWeekRange();
    const today = todayKey();
    const todaySessions = focus.filter((session) => session.endedAt.slice(0, 10) === today);
    const weekSessions = focus.filter((session) => isDateKeyInRange(session.endedAt.slice(0, 10), week.start, week.end));
    const sum = (items: FocusSession[]) => items.reduce((total, session) => total + session.durationMinutes, 0);
    return {
      todayMinutes: sum(todaySessions),
      todayCompletedSessions: todaySessions.length,
      weekMinutes: sum(weekSessions),
      totalMinutes: sum(focus),
    };
  }, [focusSessions]);

  const nearestGoal = useMemo(
    () => [...goals].filter((goal) => !goal.completed).sort((a, b) => (a.dueDate || a.targetDate || "").localeCompare(b.dueDate || b.targetDate || ""))[0],
    [goals],
  );
  const recentReflection = useMemo(() => [...reflections].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0], [reflections]);

  return {
    categories,
    todos,
    allTodos,
    archivedTodos,
    tagOptions,
    reflections,
    goals,
    focusSessions,
    timerSettings,
    loading,
    saving,
    error,
    stats,
    focusStats,
    nearestGoal,
    recentReflection,
    loadAll,
    addTodo,
    updateTodo,
    deleteTodo,
    toggleTodo,
    archiveTodo,
    unarchiveTodo,
    getTodosByDate,
    getTodayTodos,
    getWeekTodos,
    getMonthTodos,
    filterTodos,
    addCategory,
    updateCategory,
    deleteCategory,
    addReflection,
    updateReflection,
    deleteReflection,
    addGoal,
    updateGoal,
    toggleGoal,
    deleteGoal,
    addFocusSession,
    updateTimerSettings,
    exportBackup,
    importBackup,
    migrateLocalStorage,
  };
}
