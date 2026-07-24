import { useCallback, useEffect, useMemo, useState } from "react";
import type { Category } from "../types/category";
import { useCategories } from "./useCategories";
import { useGoals } from "./useGoals";
import { useMemos } from "./useMemos";
import { useReflections } from "./useReflections";
import { useTodos } from "./useTodos";

const getMessage = (error: unknown) => (error instanceof Error ? error.message : "요청 처리 중 오류가 발생했습니다.");

export function usePlannerData() {
  const categoriesState = useCategories();
  const todosState = useTodos();
  const reflectionsState = useReflections();
  const goalsState = useGoals();
  const memosState = useMemos();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      await Promise.all([
        categoriesState.loadCategories(),
        todosState.loadTodos(),
        reflectionsState.loadReflections(),
        goalsState.loadGoals(),
        memosState.loadMemos(),
      ]);
      setLoadError("");
    } catch (err) {
      setLoadError(getMessage(err));
    } finally {
      setLoading(false);
    }
  }, [
    categoriesState.loadCategories,
    goalsState.loadGoals,
    memosState.loadMemos,
    reflectionsState.loadReflections,
    todosState.loadTodos,
  ]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const addCategory = useCallback(async (input: { name: string; description?: string; color?: string; icon?: string }) => {
    await categoriesState.addCategory(input);
  }, [categoriesState.addCategory]);

  const updateCategory = useCallback(async (id: string, input: Partial<Category>) => {
    const category = await categoriesState.updateCategory(id, input);
    if (category) todosState.syncCategory(category);
  }, [categoriesState.updateCategory, todosState.syncCategory]);

  const deleteCategory = useCallback(async (id: string, mode: "moveTodos" | "deleteTodos" = "moveTodos") => {
    await categoriesState.deleteCategory(id, mode);
    todosState.removeCategoryFromTodos(id, mode);
  }, [categoriesState.deleteCategory, todosState.removeCategoryFromTodos]);

  const reorderCategories = useCallback(async (ids: string[]) => {
    await categoriesState.reorderCategories(ids);
  }, [categoriesState.reorderCategories]);

  const saving = useMemo(
    () =>
      todosState.saving ||
      categoriesState.saving ||
      reflectionsState.saving ||
      goalsState.saving ||
      memosState.saving,
    [
      categoriesState.saving,
      goalsState.saving,
      memosState.saving,
      reflectionsState.saving,
      todosState.saving,
    ],
  );

  const error =
    loadError ||
    todosState.error ||
    categoriesState.error ||
    reflectionsState.error ||
    goalsState.error ||
    memosState.error;

  return {
    categories: categoriesState.categories,
    todos: todosState.todos,
    allTodos: todosState.allTodos,
    archivedTodos: todosState.archivedTodos,
    tagOptions: todosState.tagOptions,
    reflections: reflectionsState.reflections,
    goals: goalsState.goals,
    memos: memosState.memos,
    loading,
    saving,
    error,
    stats: todosState.stats,
    nearestGoal: goalsState.nearestGoal,
    recentReflection: reflectionsState.recentReflection,
    loadAll,
    addTodo: todosState.addTodo,
    updateTodo: todosState.updateTodo,
    deleteTodo: todosState.deleteTodo,
    toggleTodo: todosState.toggleTodo,
    archiveTodo: todosState.archiveTodo,
    unarchiveTodo: todosState.unarchiveTodo,
    getTodosByDate: todosState.getTodosByDate,
    getTodayTodos: todosState.getTodayTodos,
    getYesterdayTodos: todosState.getYesterdayTodos,
    getWeekTodos: todosState.getWeekTodos,
    getMonthTodos: todosState.getMonthTodos,
    filterTodos: todosState.filterTodos,
    bringYesterdayTodosToToday: todosState.bringYesterdayTodosToToday,
    addCategory,
    updateCategory,
    deleteCategory,
    reorderCategories,
    addReflection: reflectionsState.addReflection,
    updateReflection: reflectionsState.updateReflection,
    deleteReflection: reflectionsState.deleteReflection,
    addGoal: goalsState.addGoal,
    updateGoal: goalsState.updateGoal,
    toggleGoal: goalsState.toggleGoal,
    deleteGoal: goalsState.deleteGoal,
    addMemo: memosState.addMemo,
    updateMemo: memosState.updateMemo,
    toggleMemoPin: memosState.toggleMemoPin,
    deleteMemo: memosState.deleteMemo,
  };
}
