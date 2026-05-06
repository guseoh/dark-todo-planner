import { useCallback, useEffect, useMemo, useState } from "react";
import type { Category } from "../types/category";
import { useBackup } from "./useBackup";
import { useCategories } from "./useCategories";
import { useFocusSessions } from "./useFocusSessions";
import { useGoals } from "./useGoals";
import { useReflections } from "./useReflections";
import { useTimerSettings } from "./useTimerSettings";
import { useTodos } from "./useTodos";

const getMessage = (error: unknown) => (error instanceof Error ? error.message : "요청 처리 중 오류가 발생했습니다.");

export function usePlannerData() {
  const categoriesState = useCategories();
  const todosState = useTodos();
  const reflectionsState = useReflections();
  const goalsState = useGoals();
  const focusSessionsState = useFocusSessions();
  const timerSettingsState = useTimerSettings();
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
        focusSessionsState.loadFocusSessions(),
        timerSettingsState.loadTimerSettings(),
      ]);
      setLoadError("");
    } catch (err) {
      setLoadError(getMessage(err));
    } finally {
      setLoading(false);
    }
  }, [
    categoriesState.loadCategories,
    focusSessionsState.loadFocusSessions,
    goalsState.loadGoals,
    reflectionsState.loadReflections,
    timerSettingsState.loadTimerSettings,
    todosState.loadTodos,
  ]);

  const backupState = useBackup(loadAll);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const addCategory = useCallback(async (input: { name: string; description?: string; color?: string }) => {
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

  const saving = useMemo(
    () =>
      todosState.saving ||
      categoriesState.saving ||
      reflectionsState.saving ||
      goalsState.saving ||
      focusSessionsState.saving ||
      timerSettingsState.saving ||
      backupState.saving,
    [
      backupState.saving,
      categoriesState.saving,
      focusSessionsState.saving,
      goalsState.saving,
      reflectionsState.saving,
      timerSettingsState.saving,
      todosState.saving,
    ],
  );

  const error =
    loadError ||
    todosState.error ||
    categoriesState.error ||
    reflectionsState.error ||
    goalsState.error ||
    focusSessionsState.error ||
    timerSettingsState.error ||
    backupState.error;

  return {
    categories: categoriesState.categories,
    todos: todosState.todos,
    allTodos: todosState.allTodos,
    archivedTodos: todosState.archivedTodos,
    tagOptions: todosState.tagOptions,
    reflections: reflectionsState.reflections,
    goals: goalsState.goals,
    focusSessions: focusSessionsState.focusSessions,
    timerSettings: timerSettingsState.timerSettings,
    loading,
    saving,
    error,
    stats: todosState.stats,
    focusStats: focusSessionsState.focusStats,
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
    getWeekTodos: todosState.getWeekTodos,
    getMonthTodos: todosState.getMonthTodos,
    filterTodos: todosState.filterTodos,
    addCategory,
    updateCategory,
    deleteCategory,
    addReflection: reflectionsState.addReflection,
    updateReflection: reflectionsState.updateReflection,
    deleteReflection: reflectionsState.deleteReflection,
    addGoal: goalsState.addGoal,
    updateGoal: goalsState.updateGoal,
    toggleGoal: goalsState.toggleGoal,
    deleteGoal: goalsState.deleteGoal,
    addFocusSession: focusSessionsState.addFocusSession,
    updateTimerSettings: timerSettingsState.updateTimerSettings,
    exportBackup: backupState.exportBackup,
    importBackup: backupState.importBackup,
    migrateLocalStorage: backupState.migrateLocalStorage,
  };
}
