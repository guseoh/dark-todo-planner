import { useCallback, useEffect, useMemo, useState } from "react";
import { getMonthRange, getWeekRange, isDateKeyInRange, todayKey } from "../lib/date";
import { calculateRate, priorityRank } from "../lib/todo";
import { loadTodos, saveTodos, validateTodos } from "../lib/storage";
import type { Todo, TodoFilters, TodoInput } from "../types/todo";

const createId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const normalizeOptional = (value?: string) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
};

export const defaultFilters: TodoFilters = {
  query: "",
  status: "ALL",
  priority: "ALL",
  date: "",
  sort: "DATE_ASC",
};

export function useTodos() {
  const [todos, setTodos] = useState<Todo[]>(() => loadTodos());

  useEffect(() => {
    saveTodos(todos);
  }, [todos]);

  const addTodo = useCallback((input: TodoInput) => {
    const title = input.title.trim();
    if (!title) return;

    const now = new Date().toISOString();
    const todo: Todo = {
      id: createId(),
      title,
      memo: normalizeOptional(input.memo),
      date: input.date || todayKey(),
      startTime: normalizeOptional(input.startTime),
      endTime: normalizeOptional(input.endTime),
      priority: input.priority || "MEDIUM",
      completed: false,
      createdAt: now,
      updatedAt: now,
    };

    setTodos((current) => [todo, ...current]);
  }, []);

  const updateTodo = useCallback((id: string, updates: Partial<Omit<Todo, "id" | "createdAt">>) => {
    setTodos((current) =>
      current.map((todo) =>
        todo.id === id
          ? {
              ...todo,
              ...updates,
              title: updates.title?.trim() || todo.title,
              memo: normalizeOptional(updates.memo),
              startTime: normalizeOptional(updates.startTime),
              endTime: normalizeOptional(updates.endTime),
              updatedAt: new Date().toISOString(),
            }
          : todo,
      ),
    );
  }, []);

  const deleteTodo = useCallback((id: string) => {
    setTodos((current) => current.filter((todo) => todo.id !== id));
  }, []);

  const toggleTodo = useCallback((id: string) => {
    setTodos((current) =>
      current.map((todo) =>
        todo.id === id
          ? { ...todo, completed: !todo.completed, updatedAt: new Date().toISOString() }
          : todo,
      ),
    );
  }, []);

  const replaceTodos = useCallback((nextTodos: Todo[]) => {
    setTodos(nextTodos);
  }, []);

  const importTodos = useCallback((value: unknown) => {
    const validated = validateTodos(value);
    if (!validated) return false;
    replaceTodos(validated);
    return true;
  }, [replaceTodos]);

  const clearTodos = useCallback(() => {
    setTodos([]);
  }, []);

  const getTodosByDate = useCallback(
    (date: string) => todos.filter((todo) => todo.date === date),
    [todos],
  );

  const getTodayTodos = useCallback(() => getTodosByDate(todayKey()), [getTodosByDate]);

  const getWeekTodos = useCallback(
    (date = new Date()) => {
      const { start, end } = getWeekRange(date);
      return todos.filter((todo) => isDateKeyInRange(todo.date, start, end));
    },
    [todos],
  );

  const getMonthTodos = useCallback(
    (date = new Date()) => {
      const { start, end } = getMonthRange(date);
      return todos.filter((todo) => isDateKeyInRange(todo.date, start, end));
    },
    [todos],
  );

  const searchTodos = useCallback(
    (query: string) => {
      const normalized = query.trim().toLowerCase();
      if (!normalized) return todos;
      return todos.filter((todo) =>
        `${todo.title} ${todo.memo || ""}`.toLowerCase().includes(normalized),
      );
    },
    [todos],
  );

  const filterTodos = useCallback(
    (filters: TodoFilters) => {
      let result = searchTodos(filters.query);

      if (filters.status === "ACTIVE") result = result.filter((todo) => !todo.completed);
      if (filters.status === "COMPLETED") result = result.filter((todo) => todo.completed);
      if (filters.priority !== "ALL") {
        result = result.filter((todo) => todo.priority === filters.priority);
      }
      if (filters.date) result = result.filter((todo) => todo.date === filters.date);

      return [...result].sort((a, b) => {
        if (filters.sort === "OLDEST") return a.createdAt.localeCompare(b.createdAt);
        if (filters.sort === "PRIORITY") return priorityRank[b.priority] - priorityRank[a.priority];
        if (filters.sort === "DATE_ASC") {
          const base = new Date(todayKey()).getTime();
          const aDistance = Math.abs(new Date(a.date).getTime() - base);
          const bDistance = Math.abs(new Date(b.date).getTime() - base);
          if (aDistance !== bDistance) return aDistance - bDistance;
          return a.date.localeCompare(b.date);
        }
        return b.createdAt.localeCompare(a.createdAt);
      });
    },
    [searchTodos],
  );

  const stats = useMemo(() => {
    const todayTodos = todos.filter((todo) => todo.date === todayKey());
    const weekTodos = todos.filter((todo) => {
      const { start, end } = getWeekRange();
      return isDateKeyInRange(todo.date, start, end);
    });
    const monthTodos = todos.filter((todo) => {
      const { start, end } = getMonthRange();
      return isDateKeyInRange(todo.date, start, end);
    });

    return {
      todayTotal: todayTodos.length,
      todayCompleted: todayTodos.filter((todo) => todo.completed).length,
      todayActive: todayTodos.filter((todo) => !todo.completed).length,
      todayRate: calculateRate(todayTodos),
      weekRate: calculateRate(weekTodos),
      monthTotal: monthTodos.length,
      total: todos.length,
      completedTotal: todos.filter((todo) => todo.completed).length,
    };
  }, [todos]);

  return {
    todos,
    stats,
    addTodo,
    updateTodo,
    deleteTodo,
    toggleTodo,
    replaceTodos,
    importTodos,
    clearTodos,
    getTodosByDate,
    getTodayTodos,
    getWeekTodos,
    getMonthTodos,
    searchTodos,
    filterTodos,
  };
}
