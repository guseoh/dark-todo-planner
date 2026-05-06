import { useCallback, useEffect, useMemo, useState } from "react";
import {
  getMonthGrid,
  getMonthRange,
  getWeekDays,
  getWeekRange,
  isDateKeyInRange,
  todayKey,
  toDateKey,
} from "../lib/date";
import { createId } from "../lib/id";
import { calculateRate, getAllTags, priorityRank, todoOccursOnDate } from "../lib/todo";
import { loadTodos, normalizeTodo, parseTags, saveTodos, validateTodos } from "../lib/storage";
import type { Todo, TodoFilters, TodoInput } from "../types/todo";

const normalizeOptional = (value?: string) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
};

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

export function useTodos() {
  const [todos, setTodos] = useState<Todo[]>(() => loadTodos());

  useEffect(() => {
    saveTodos(todos);
  }, [todos]);

  const activeTodos = useMemo(() => todos.filter((todo) => !todo.archived), [todos]);
  const archivedTodos = useMemo(() => todos.filter((todo) => todo.archived), [todos]);
  const tagOptions = useMemo(() => getAllTags(activeTodos), [activeTodos]);

  const addTodo = useCallback((input: TodoInput) => {
    const title = input.title.trim();
    if (!title) return;

    const now = new Date().toISOString();
    const todo: Todo = {
      id: createId(),
      title,
      memo: normalizeOptional(input.memo),
      date: input.date || todayKey(),
      priority: input.priority || "MEDIUM",
      completed: false,
      createdAt: now,
      updatedAt: now,
      repeat: input.repeat || "NONE",
      tags: parseTags(input.tags),
      archived: false,
      archivedAt: undefined,
    };

    setTodos((current) => [todo, ...current]);
  }, []);

  const updateTodo = useCallback((id: string, updates: Partial<Omit<Todo, "id" | "createdAt">>) => {
    setTodos((current) =>
      current.map((todo) => {
        if (todo.id !== id) return todo;
        const next = normalizeTodo({
          ...todo,
          ...updates,
          title: updates.title?.trim() || todo.title,
          memo: "memo" in updates ? normalizeOptional(updates.memo) : todo.memo,
          startTime: "startTime" in updates ? normalizeOptional(updates.startTime) : todo.startTime,
          endTime: "endTime" in updates ? normalizeOptional(updates.endTime) : todo.endTime,
          tags: "tags" in updates ? parseTags(updates.tags) : todo.tags,
          updatedAt: new Date().toISOString(),
        });
        return next || todo;
      }),
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

  const archiveTodo = useCallback((id: string) => {
    setTodos((current) =>
      current.map((todo) =>
        todo.id === id
          ? { ...todo, archived: true, archivedAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
          : todo,
      ),
    );
  }, []);

  const unarchiveTodo = useCallback((id: string) => {
    setTodos((current) =>
      current.map((todo) =>
        todo.id === id
          ? { ...todo, archived: false, archivedAt: undefined, updatedAt: new Date().toISOString() }
          : todo,
      ),
    );
  }, []);

  const replaceTodos = useCallback((nextTodos: Todo[]) => {
    setTodos(nextTodos.map(normalizeTodo).filter(Boolean) as Todo[]);
  }, []);

  const importTodos = useCallback(
    (value: unknown) => {
      const validated = validateTodos(value);
      if (!validated) return false;
      replaceTodos(validated);
      return true;
    },
    [replaceTodos],
  );

  const clearTodos = useCallback(() => {
    setTodos([]);
  }, []);

  const getTodosByDate = useCallback(
    (date: string) => activeTodos.filter((todo) => todoOccursOnDate(todo, date)),
    [activeTodos],
  );

  const getTodayTodos = useCallback(() => getTodosByDate(todayKey()), [getTodosByDate]);

  const getWeekTodos = useCallback(
    (date = new Date()) => {
      const days = getWeekDays(date).map(toDateKey);
      return activeTodos.filter((todo) => days.some((dateKey) => todoOccursOnDate(todo, dateKey)));
    },
    [activeTodos],
  );

  const getMonthTodos = useCallback(
    (date = new Date()) => {
      const days = getMonthGrid(date).map(toDateKey);
      return activeTodos.filter((todo) => days.some((dateKey) => todoOccursOnDate(todo, dateKey)));
    },
    [activeTodos],
  );

  const searchTodos = useCallback(
    (query: string) => {
      const normalized = query.trim().toLowerCase();
      if (!normalized) return activeTodos;
      return activeTodos.filter((todo) =>
        `${todo.title} ${todo.memo || ""} ${(todo.tags || []).join(" ")}`.toLowerCase().includes(normalized),
      );
    },
    [activeTodos],
  );

  const filterTodos = useCallback(
    (filters: TodoFilters) => {
      let result = searchTodos(filters.query);

      if (filters.status === "ACTIVE") result = result.filter((todo) => !todo.completed);
      if (filters.status === "COMPLETED") result = result.filter((todo) => todo.completed);
      if (filters.priority !== "ALL") result = result.filter((todo) => todo.priority === filters.priority);
      if (filters.tag) result = result.filter((todo) => (todo.tags || []).includes(filters.tag));
      if (filters.date) result = result.filter((todo) => todoOccursOnDate(todo, filters.date));

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
    const todayTodos = activeTodos.filter((todo) => todoOccursOnDate(todo, todayKey()));
    const weekTodos = activeTodos.filter((todo) => {
      const { start, end } = getWeekRange();
      return isDateKeyInRange(todo.date, start, end) || getWeekDays().some((day) => todoOccursOnDate(todo, toDateKey(day)));
    });
    const monthTodos = activeTodos.filter((todo) => {
      const { start, end } = getMonthRange();
      return isDateKeyInRange(todo.date, start, end) || getMonthGrid().some((day) => todoOccursOnDate(todo, toDateKey(day)));
    });

    return {
      todayTotal: todayTodos.length,
      todayCompleted: todayTodos.filter((todo) => todo.completed).length,
      todayActive: todayTodos.filter((todo) => !todo.completed).length,
      todayRate: calculateRate(todayTodos),
      weekRate: calculateRate(weekTodos),
      monthTotal: monthTodos.length,
      total: activeTodos.length,
      completedTotal: activeTodos.filter((todo) => todo.completed).length,
      archivedTotal: archivedTodos.length,
    };
  }, [activeTodos, archivedTodos.length]);

  return {
    todos: activeTodos,
    allTodos: todos,
    archivedTodos,
    tagOptions,
    stats,
    addTodo,
    updateTodo,
    deleteTodo,
    toggleTodo,
    archiveTodo,
    unarchiveTodo,
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
