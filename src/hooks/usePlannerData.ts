import { useCallback, useEffect, useMemo, useState } from "react";
import type { Category } from "../types/category";
import { useCategories } from "./useCategories";
import { useGoals } from "./useGoals";
import { useMemos } from "./useMemos";
import { usePlanning } from "./usePlanning";
import { usePlannerSettings } from "./usePlannerSettings";
import { useProjects } from "./useProjects";
import { useTimePlanning } from "./useTimePlanning";
import { useTodos } from "./useTodos";
import { classifyPlannerErrors } from "../lib/plannerLoadState";

const getMessage = (error: unknown) => (error instanceof Error ? error.message : "요청 처리 중 오류가 발생했습니다.");

export function usePlannerData() {
  const categoriesState = useCategories();
  const todosState = useTodos();
  const goalsState = useGoals();
  const memosState = useMemos();
  const projectsState = useProjects();
  const planningState = usePlanning();
  const timeState = useTimePlanning();
  const settingsState = usePlannerSettings();
  const [loading, setLoading] = useState(true);
  const [loadedOnce, setLoadedOnce] = useState(false);
  const [loadError, setLoadError] = useState("");

  const loadAll = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      await Promise.all([
        categoriesState.loadCategories(),
        todosState.loadTodos(),
        goalsState.loadGoals(),
        memosState.loadMemos(),
        projectsState.loadProjects(),
        planningState.loadPlanning(),
        timeState.loadTimePlanning(),
        settingsState.loadSettings(),
      ]);
      const automation = await settingsState.runAutomations();
      if (automation && (automation.carriedOver > 0 || automation.autoArchived > 0)) await todosState.loadTodos();
      setLoadedOnce(true);
      setLoadError("");
    } catch (err) {
      setLoadError(getMessage(err));
    } finally {
      setLoading(false);
    }
  }, [categoriesState.loadCategories, goalsState.loadGoals, memosState.loadMemos, planningState.loadPlanning, projectsState.loadProjects, settingsState.loadSettings, settingsState.runAutomations, timeState.loadTimePlanning, todosState.loadTodos]);

  useEffect(() => { void loadAll(); }, [loadAll]);

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

  const reorderCategories = useCallback(async (ids: string[]) => { await categoriesState.reorderCategories(ids); }, [categoriesState.reorderCategories]);

  const saving = useMemo(() =>
    todosState.saving || categoriesState.saving || goalsState.saving || memosState.saving || projectsState.saving || planningState.saving || timeState.saving || settingsState.saving,
  [categoriesState.saving, goalsState.saving, memosState.saving, planningState.saving, projectsState.saving, settingsState.saving, timeState.saving, todosState.saving]);

  const operationError = todosState.error || categoriesState.error || goalsState.error || memosState.error || projectsState.error || planningState.error || timeState.error || settingsState.error;
  const { initialLoadError, backgroundOrOperationError } = classifyPlannerErrors({ loadedOnce, loadError, operationError });

  return {
    categories: categoriesState.categories,
    todos: todosState.todos,
    allTodos: todosState.allTodos,
    archivedTodos: todosState.archivedTodos,
    inboxTodos: todosState.inboxTodos,
    tagOptions: todosState.tagOptions,
    duplicateTodoIds: todosState.duplicateTodoIds,
    goals: goalsState.goals,
    memos: memosState.memos,
    projects: projectsState.projects,
    activeProjects: projectsState.activeProjects,
    archivedProjects: projectsState.archivedProjects,
    milestones: projectsState.milestones,
    projectDecisions: projectsState.decisions,
    dailyPlan: planningState.dailyPlan,
    weeklyReview: planningState.weeklyReview,
    savedViews: planningState.savedViews,
    taskTemplates: planningState.taskTemplates,
    focusSessions: timeState.focusSessions,
    timeBlocks: timeState.timeBlocks,
    timerSettings: timeState.timerSettings,
    plannerSettings: settingsState.settings,
    loading, loadedOnce, saving, initialLoadError, backgroundOrOperationError, connectionError: loadError,
    stats: todosState.stats, nearestGoal: goalsState.nearestGoal,
    pendingTodoDelete: todosState.pendingDelete, pendingMemoDelete: memosState.pendingDelete,
    loadAll,
    addTodo: todosState.addTodo, updateTodo: todosState.updateTodo, deleteTodo: todosState.deleteTodo, undoDeleteTodo: todosState.undoDeleteTodo,
    deleteTodos: todosState.deleteTodos, bulkUpdateTodos: todosState.bulkUpdateTodos, toggleTodo: todosState.toggleTodo, archiveTodo: todosState.archiveTodo, unarchiveTodo: todosState.unarchiveTodo,
    getTodosByDate: todosState.getTodosByDate, getTodayTodos: todosState.getTodayTodos, getOverdueIncompleteTodos: todosState.getOverdueIncompleteTodos,
    getWeekTodos: todosState.getWeekTodos, getMonthTodos: todosState.getMonthTodos, filterTodos: todosState.filterTodos, bringOverdueTodosToToday: todosState.bringOverdueTodosToToday,
    addCategory, updateCategory, deleteCategory, reorderCategories,
    addGoal: goalsState.addGoal, updateGoal: goalsState.updateGoal, toggleGoal: goalsState.toggleGoal, deleteGoal: goalsState.deleteGoal,
    addMemo: memosState.addMemo, updateMemo: memosState.updateMemo, updateMemoLinks: memosState.updateMemoLinks, toggleMemoPin: memosState.toggleMemoPin, deleteMemo: memosState.deleteMemo, undoDeleteMemo: memosState.undoDeleteMemo,
    addProject: projectsState.addProject, updateProject: projectsState.updateProject, archiveProject: projectsState.archiveProject, unarchiveProject: projectsState.unarchiveProject,
    addMilestone: projectsState.addMilestone, updateMilestone: projectsState.updateMilestone, deleteMilestone: projectsState.deleteMilestone,
    addProjectDecision: projectsState.addDecision, updateProjectDecision: projectsState.updateDecision, deleteProjectDecision: projectsState.deleteDecision,
    saveDailyPlan: planningState.saveDailyPlan, saveWeeklyReview: planningState.saveWeeklyReview,
    addSavedView: planningState.addSavedView, deleteSavedView: planningState.deleteSavedView,
    addTaskTemplate: planningState.addTaskTemplate, deleteTaskTemplate: planningState.deleteTaskTemplate,
    addFocusSession: timeState.addFocusSession, saveTimerSettings: timeState.saveTimerSettings,
    addTimeBlock: timeState.addTimeBlock, updateTimeBlock: timeState.updateTimeBlock, deleteTimeBlock: timeState.deleteTimeBlock,
    savePlannerSettings: settingsState.saveSettings,
  };
}
