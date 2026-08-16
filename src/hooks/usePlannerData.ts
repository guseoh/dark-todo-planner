import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { classifyPlannerErrors } from "../lib/plannerLoadState";
import type { Category } from "../types/category";
import { useCategories } from "./useCategories";
import { useGoals } from "./useGoals";
import { useMemos } from "./useMemos";
import { usePlanning } from "./usePlanning";
import { usePlannerSettings } from "./usePlannerSettings";
import { useProjects, type ProjectDuplicateMode } from "./useProjects";
import { useTimePlanning } from "./useTimePlanning";
import { useTodos } from "./useTodos";

const getMessage = (error: unknown) => error instanceof Error ? error.message : "요청 처리 중 오류가 발생했습니다.";
const IDLE_LOAD_TIMEOUT_MS = 1_200;

const scheduleIdleTask = (task: () => void) => {
  if (typeof window === "undefined") return () => undefined;
  if ("requestIdleCallback" in window) {
    const id = window.requestIdleCallback(task, { timeout: IDLE_LOAD_TIMEOUT_MS });
    return () => window.cancelIdleCallback(id);
  }
  const id = window.setTimeout(task, 50);
  return () => window.clearTimeout(id);
};

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
  const [deferredLoaded, setDeferredLoaded] = useState(false);
  const [loadError, setLoadError] = useState("");
  const deferredLoadedRef = useRef(false);
  const deferredLoadRef = useRef<Promise<void> | null>(null);

  const runPlannerAutomations = useCallback(async () => {
    const automation = await settingsState.runAutomations();
    if (automation && (automation.carriedOver > 0 || automation.autoArchived > 0)) await todosState.loadTodos();
  }, [settingsState.runAutomations, todosState.loadTodos]);

  const loadCoreData = useCallback(async () => {
    await Promise.all([
      categoriesState.loadCategories(),
      todosState.loadTodos(),
      projectsState.loadProjectList(),
      settingsState.loadSettings(),
    ]);
    await runPlannerAutomations();
  }, [categoriesState.loadCategories, projectsState.loadProjectList, runPlannerAutomations, settingsState.loadSettings, todosState.loadTodos]);

  const loadDeferredData = useCallback(async () => {
    if (deferredLoadedRef.current) return;
    if (deferredLoadRef.current) return deferredLoadRef.current;

    const promise = Promise.all([
      goalsState.loadGoals(),
      memosState.loadMemos(),
      projectsState.loadProjectDetails(),
      planningState.loadPlanning(),
      timeState.loadTimePlanning(),
    ]).then(() => {
      deferredLoadedRef.current = true;
      setDeferredLoaded(true);
    }).finally(() => {
      deferredLoadRef.current = null;
    });

    deferredLoadRef.current = promise;
    return promise;
  }, [goalsState.loadGoals, memosState.loadMemos, planningState.loadPlanning, projectsState.loadProjectDetails, timeState.loadTimePlanning]);

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
      await runPlannerAutomations();
      deferredLoadedRef.current = true;
      setDeferredLoaded(true);
      setLoadedOnce(true);
      setLoadError("");
    } catch (err) {
      setLoadError(getMessage(err));
    } finally {
      setLoading(false);
    }
  }, [categoriesState.loadCategories, goalsState.loadGoals, memosState.loadMemos, planningState.loadPlanning, projectsState.loadProjects, runPlannerAutomations, settingsState.loadSettings, timeState.loadTimePlanning, todosState.loadTodos]);

  const loadInitial = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      await loadCoreData();
      setLoadedOnce(true);
      setLoadError("");
      return true;
    } catch (err) {
      setLoadError(getMessage(err));
      return false;
    } finally {
      setLoading(false);
    }
  }, [loadCoreData]);

  useEffect(() => {
    let cancelDeferred = () => undefined;
    let active = true;

    void loadInitial().then((success) => {
      if (!active || !success) return;
      cancelDeferred = scheduleIdleTask(() => {
        void loadDeferredData().catch(() => undefined);
      });
    });

    return () => {
      active = false;
      cancelDeferred();
    };
  }, [loadDeferredData, loadInitial]);

  const addCategory = useCallback(async (input: { name: string; description?: string; color?: string; icon?: string }) => {
    await categoriesState.addCategory(input);
  }, [categoriesState.addCategory]);

  const updateCategory = useCallback(async (id: string, input: Partial<Category>) => {
    const category = await categoriesState.updateCategory(id, input);
    if (category) todosState.syncCategory(category);
  }, [categoriesState.updateCategory, todosState.syncCategory]);

  const deleteCategory = useCallback(async (id: string, mode: "moveTodos" | "deleteTodos" = "moveTodos") => {
    if (mode === "deleteTodos") {
      const todoIds = todosState.allTodos.filter((todo) => todo.categoryId === id).map((todo) => todo.id);
      if (todoIds.length) {
        const movedToTrash = await todosState.deleteTodos(todoIds);
        if (!movedToTrash) throw new Error("카테고리의 Todo를 휴지통으로 이동하지 못했습니다.");
      }
      await categoriesState.deleteCategory(id, "moveTodos");
      todosState.removeCategoryFromTodos(id, "deleteTodos");
      return;
    }

    await categoriesState.deleteCategory(id, "moveTodos");
    todosState.removeCategoryFromTodos(id, "moveTodos");
  }, [categoriesState.deleteCategory, todosState.allTodos, todosState.deleteTodos, todosState.removeCategoryFromTodos]);

  const reorderCategories = useCallback(async (ids: string[]) => {
    await categoriesState.reorderCategories(ids);
  }, [categoriesState.reorderCategories]);

  const duplicateProject = useCallback(async (id: string, input: { name: string; mode: ProjectDuplicateMode }) => {
    const project = await projectsState.duplicateProject(id, input);
    if (project) await todosState.loadTodos();
    return project;
  }, [projectsState.duplicateProject, todosState.loadTodos]);

  const saving = useMemo(() => (
    todosState.saving
    || categoriesState.saving
    || goalsState.saving
    || memosState.saving
    || projectsState.saving
    || planningState.saving
    || timeState.saving
    || settingsState.saving
  ), [categoriesState.saving, goalsState.saving, memosState.saving, planningState.saving, projectsState.saving, settingsState.saving, timeState.saving, todosState.saving]);

  const operationError = todosState.error
    || categoriesState.error
    || goalsState.error
    || memosState.error
    || projectsState.error
    || planningState.error
    || timeState.error
    || settingsState.error;
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
    loading,
    loadedOnce,
    deferredLoaded,
    saving,
    initialLoadError,
    backgroundOrOperationError,
    connectionError: loadError,
    stats: todosState.stats,
    nearestGoal: goalsState.nearestGoal,
    pendingTodoDelete: todosState.pendingDelete,
    pendingMemoDelete: memosState.pendingDelete,
    loadAll,
    ensureDeferredData: loadDeferredData,
    addTodo: todosState.addTodo,
    updateTodo: todosState.updateTodo,
    deleteTodo: todosState.deleteTodo,
    undoDeleteTodo: todosState.undoDeleteTodo,
    deleteTodos: todosState.deleteTodos,
    bulkUpdateTodos: todosState.bulkUpdateTodos,
    toggleTodo: todosState.toggleTodo,
    archiveTodo: todosState.archiveTodo,
    unarchiveTodo: todosState.unarchiveTodo,
    getTodosByDate: todosState.getTodosByDate,
    getTodayTodos: todosState.getTodayTodos,
    getOverdueIncompleteTodos: todosState.getOverdueIncompleteTodos,
    getWeekTodos: todosState.getWeekTodos,
    getMonthTodos: todosState.getMonthTodos,
    filterTodos: todosState.filterTodos,
    bringOverdueTodosToToday: todosState.bringOverdueTodosToToday,
    addCategory,
    updateCategory,
    deleteCategory,
    reorderCategories,
    addGoal: goalsState.addGoal,
    updateGoal: goalsState.updateGoal,
    toggleGoal: goalsState.toggleGoal,
    deleteGoal: goalsState.deleteGoal,
    addMemo: memosState.addMemo,
    updateMemo: memosState.updateMemo,
    updateMemoLinks: memosState.updateMemoLinks,
    toggleMemoPin: memosState.toggleMemoPin,
    deleteMemo: memosState.deleteMemo,
    undoDeleteMemo: memosState.undoDeleteMemo,
    addProject: projectsState.addProject,
    updateProject: projectsState.updateProject,
    duplicateProject,
    archiveProject: projectsState.archiveProject,
    unarchiveProject: projectsState.unarchiveProject,
    addMilestone: projectsState.addMilestone,
    updateMilestone: projectsState.updateMilestone,
    deleteMilestone: projectsState.deleteMilestone,
    addProjectDecision: projectsState.addDecision,
    updateProjectDecision: projectsState.updateDecision,
    deleteProjectDecision: projectsState.deleteDecision,
    saveDailyPlan: planningState.saveDailyPlan,
    saveWeeklyReview: planningState.saveWeeklyReview,
    addSavedView: planningState.addSavedView,
    deleteSavedView: planningState.deleteSavedView,
    addTaskTemplate: planningState.addTaskTemplate,
    deleteTaskTemplate: planningState.deleteTaskTemplate,
    addFocusSession: timeState.addFocusSession,
    saveTimerSettings: timeState.saveTimerSettings,
    addTimeBlock: timeState.addTimeBlock,
    updateTimeBlock: timeState.updateTimeBlock,
    deleteTimeBlock: timeState.deleteTimeBlock,
    savePlannerSettings: settingsState.saveSettings,
  };
}
