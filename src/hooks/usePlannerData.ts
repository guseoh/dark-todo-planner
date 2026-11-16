import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { onRevalidated } from "../lib/api/bootstrap";
import { markStartup } from "../lib/perf";
import { classifyPlannerErrors } from "../lib/plannerLoadState";
import type { Category } from "../types/category";
import { useCategories } from "./useCategories";
import { useGoals } from "./useGoals";
import { useMemos } from "./useMemos";
import { usePlannerSettings } from "./usePlannerSettings";
import { useProjects, type ProjectDuplicateMode } from "./useProjects";
import { useTodos } from "./useTodos";

const getMessage = (error: unknown) => error instanceof Error ? error.message : "요청 처리 중 오류가 발생했습니다.";
const DEFERRED_LOAD_DELAY_MS = 80;

const scheduleDeferredTask = (task: () => void): (() => void) => {
  if (typeof window === "undefined") return () => {};
  const id = globalThis.setTimeout(task, DEFERRED_LOAD_DELAY_MS);
  return () => globalThis.clearTimeout(id);
};

/** Carry-over / auto-archive is housekeeping: run it when the browser is idle instead of racing the first paint. */
const scheduleIdleTask = (task: () => void): (() => void) => {
  if (typeof window === "undefined") return () => {};
  if (typeof window.requestIdleCallback === "function") {
    const id = window.requestIdleCallback(task, { timeout: 3_000 });
    return () => window.cancelIdleCallback(id);
  }
  const id = globalThis.setTimeout(task, 1_000);
  return () => globalThis.clearTimeout(id);
};

export function usePlannerData() {
  const categoriesState = useCategories();
  const todosState = useTodos();
  const goalsState = useGoals();
  const memosState = useMemos();
  const projectsState = useProjects();
  const settingsState = usePlannerSettings();

  const [loading, setLoading] = useState(true);
  const [loadedOnce, setLoadedOnce] = useState(false);
  const [loadError, setLoadError] = useState("");
  const deferredLoadedRef = useRef(false);
  const deferredLoadRef = useRef<Promise<void> | null>(null);

  const runPlannerAutomations = useCallback(async () => {
    const automation = await settingsState.runAutomations();
    if (automation && (automation.carriedOver > 0 || automation.autoArchived > 0)) await todosState.loadTodos();
  }, [settingsState.runAutomations, todosState.loadTodos]);

  const loadCoreData = useCallback(async () => {
    // First paint requires actual Todo/category/project/settings data, not the
    // potentially slow automation POST and follow-up refresh.
    await Promise.all([
      categoriesState.loadCategories(),
      todosState.loadTodos(),
      projectsState.loadProjectList(),
      settingsState.loadSettings(),
    ]);
  }, [categoriesState.loadCategories, projectsState.loadProjectList, settingsState.loadSettings, todosState.loadTodos]);

  const loadDeferredData = useCallback(async () => {
    if (deferredLoadedRef.current) return;
    if (deferredLoadRef.current) return deferredLoadRef.current;

    const promise = Promise.all([
      goalsState.loadGoals(),
      memosState.loadMemos(),
      projectsState.loadProjectDetails(),
    ]).then(() => {
      deferredLoadedRef.current = true;
    }).finally(() => {
      deferredLoadRef.current = null;
    });

    deferredLoadRef.current = promise;
    return promise;
  }, [goalsState.loadGoals, memosState.loadMemos, projectsState.loadProjectDetails]);

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
        settingsState.loadSettings(),
      ]);
      await runPlannerAutomations();
      deferredLoadedRef.current = true;
      setLoadedOnce(true);
      setLoadError("");
    } catch (err) {
      setLoadError(getMessage(err));
    } finally {
      setLoading(false);
    }
  }, [categoriesState.loadCategories, goalsState.loadGoals, memosState.loadMemos, projectsState.loadProjects, runPlannerAutomations, settingsState.loadSettings, todosState.loadTodos]);

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
    let cancelDeferred: () => void = () => {};
    let cancelIdle: () => void = () => {};
    let active = true;

    void loadInitial().then((success) => {
      if (!active || !success) return;
      markStartup("data-ready");
      cancelDeferred = scheduleDeferredTask(() => {
        // The UI is now usable. Load supporting pages in the background.
        void loadDeferredData().catch(() => undefined);
      });
      // Apply carry-over / auto-archive when idle; it refreshes Todos if anything moved.
      cancelIdle = scheduleIdleTask(() => { void runPlannerAutomations().catch(() => undefined); });
    });

    return () => {
      active = false;
      cancelDeferred();
      cancelIdle();
    };
  }, [loadDeferredData, loadInitial, runPlannerAutomations]);

  // The first screen came from the last visit's snapshot and the server's answer differs: reload quietly.
  useEffect(() => onRevalidated(() => {
    void Promise.all([
      loadCoreData(),
      goalsState.loadGoals(),
      memosState.loadMemos(),
      projectsState.loadProjectDetails(),
    ]).catch(() => undefined);
  }), [goalsState.loadGoals, loadCoreData, memosState.loadMemos, projectsState.loadProjectDetails]);

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

  const deleteProject = useCallback(async (id: string) => {
    const deleted = await projectsState.deleteProject(id);
    if (!deleted) return false;
    await Promise.all([todosState.loadTodos(), memosState.loadMemos()]);
    return true;
  }, [memosState.loadMemos, projectsState.deleteProject, todosState.loadTodos]);

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
    || settingsState.saving
  ), [categoriesState.saving, goalsState.saving, memosState.saving, projectsState.saving, settingsState.saving, todosState.saving]);

  const operationError = todosState.error
    || categoriesState.error
    || goalsState.error
    || memosState.error
    || projectsState.error
    || settingsState.error;
  const { initialLoadError, backgroundOrOperationError } = classifyPlannerErrors({ loadedOnce, loadError, operationError });

  return {
    categories: categoriesState.categories,
    todos: todosState.todos,
    allTodos: todosState.allTodos,
    archivedTodos: todosState.archivedTodos,
    inboxTodos: todosState.inboxTodos,
    duplicateTodoIds: todosState.duplicateTodoIds,
    goals: goalsState.goals,
    loadGoals: goalsState.loadGoals,
    memos: memosState.memos,
    projects: projectsState.projects,
    activeProjects: projectsState.activeProjects,
    archivedProjects: projectsState.archivedProjects,
    milestones: projectsState.milestones,
    projectDecisions: projectsState.decisions,
    plannerSettings: settingsState.settings,
    loading,
    loadedOnce,
    saving,
    initialLoadError,
    backgroundOrOperationError,
    connectionError: loadError,
    stats: todosState.stats,
    nearestGoal: goalsState.nearestGoal,
    pendingTodoDelete: todosState.pendingDelete,
    pendingMemoDelete: memosState.pendingDelete,
    loadAll,
    loadTodos: todosState.loadTodos,
    ensureDeferredData: loadDeferredData,
    addTodo: todosState.addTodo,
    updateTodo: todosState.updateTodo,
    reorderTodos: todosState.reorderTodos,
    deleteTodo: todosState.deleteTodo,
    undoDeleteTodo: todosState.undoDeleteTodo,
    setDeleteUndoPaused: todosState.setDeleteUndoPaused,
    detachTodo: todosState.detachTodo,
    restoreTodoProjectLinks: todosState.restoreTodoProjectLinks,
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
    deleteProject,
    duplicateProject,
    archiveProject: projectsState.archiveProject,
    unarchiveProject: projectsState.unarchiveProject,
    addMilestone: projectsState.addMilestone,
    updateMilestone: projectsState.updateMilestone,
    deleteMilestone: projectsState.deleteMilestone,
    addProjectDecision: projectsState.addDecision,
    updateProjectDecision: projectsState.updateDecision,
    deleteProjectDecision: projectsState.deleteDecision,
    savePlannerSettings: settingsState.saveSettings,
    patchPlannerPreferences: settingsState.patchPreferences,
  };
}
