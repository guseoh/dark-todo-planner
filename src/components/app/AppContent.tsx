import { lazy, Suspense } from "react";
import { api, jsonBody } from "../../lib/api/client";
import { getPlannerToday } from "../../lib/date";
import { prepareOverdueBulkImport } from "../../lib/todoBulkImport";
import type { OverdueTodoImportMode, OverdueTodoImportResult } from "../../lib/todoRecovery";
import { LoadingState } from "../common/LoadingState";
import type { AppView } from "../layout/Sidebar";
import { TodayPage } from "../../pages/TodayPage";

type PlannerData = ReturnType<typeof import("../../hooks/usePlannerData").usePlannerData>;
type ToggleTodo = PlannerData["toggleTodo"];
type UpdateTodo = PlannerData["updateTodo"];

const WeekPage = lazy(() => import("../../pages/WeekPage").then((module) => ({ default: module.WeekPage })));
const MonthPage = lazy(() => import("../../pages/MonthPage").then((module) => ({ default: module.MonthPage })));
const ProjectPage = lazy(() => import("../../pages/ProjectPage").then((module) => ({ default: module.ProjectPage })));
const AllTodosPage = lazy(() => import("../../pages/AllTodosPage").then((module) => ({ default: module.AllTodosPage })));
const MemoPage = lazy(() => import("../../pages/MemoPage").then((module) => ({ default: module.MemoPage })));
const ScratchpadPage = lazy(() => import("../../pages/ScratchpadPage").then((module) => ({ default: module.ScratchpadPage })));
const TrashPage = lazy(() => import("../../pages/TrashPage").then((module) => ({ default: module.TrashPage })));
const SettingsPage = lazy(() => import("../../pages/SettingsPage").then((module) => ({ default: module.SettingsPage })));
const ExportPanel = lazy(() => import("../settings/ExportPanel").then((module) => ({ default: module.ExportPanel })));

export const viewsRequiringDeferredData = new Set<AppView>(["week", "month", "projects", "memo", "settings"]);

type AppContentProps = {
  activeView: AppView;
  planner: PlannerData;
  onToggleTodo?: ToggleTodo;
  onUpdateTodo?: UpdateTodo;
};

export function AppContent({ activeView, planner, onToggleTodo, onUpdateTodo }: AppContentProps) {
  const toggleTodo = onToggleTodo ?? planner.toggleTodo;
  const updateTodo = onUpdateTodo ?? planner.updateTodo;

  const bringOverdueTodosToToday = async (
    selectedIds: ReadonlySet<string>,
    mode: OverdueTodoImportMode,
  ): Promise<OverdueTodoImportResult> => {
    const today = getPlannerToday();
    const prepared = prepareOverdueBulkImport(
      planner.getOverdueIncompleteTodos(),
      selectedIds,
      planner.getTodosByDate(today),
    );

    if (!prepared.ids.length) {
      return { total: prepared.total, success: 0, skipped: prepared.skipped, failed: 0, mode };
    }

    try {
      if (mode === "move") {
        const success = await planner.bulkUpdateTodos(prepared.ids, { type: "DATE", value: today });
        return {
          total: prepared.total,
          success: success ? prepared.ids.length : 0,
          skipped: prepared.skipped,
          failed: success ? 0 : prepared.ids.length,
          mode,
        };
      }

      const result = await api<{ copied: number; missing: number }>("/api/todos/bulk-copy", {
        method: "POST",
        ...jsonBody({ ids: prepared.ids, date: today }),
      });
      if (result.copied > 0) await planner.loadTodos();
      return {
        total: prepared.total,
        success: result.copied,
        skipped: prepared.skipped,
        failed: result.missing,
        mode,
      };
    } catch {
      return {
        total: prepared.total,
        success: 0,
        skipped: prepared.skipped,
        failed: prepared.ids.length,
        mode,
      };
    }
  };

  let content: JSX.Element;

  switch (activeView) {
    case "today":
      content = <TodayPage todayTodos={planner.getTodayTodos()} stats={planner.stats} onAdd={planner.addTodo} onToggle={toggleTodo} onDelete={planner.deleteTodo} onDeleteMany={planner.deleteTodos} onUpdate={updateTodo} categories={planner.categories} projects={planner.projects} onAddCategory={planner.addCategory} onUpdateCategory={planner.updateCategory} onDeleteCategory={planner.deleteCategory} onReorderCategories={planner.reorderCategories} overdueTodos={planner.getOverdueIncompleteTodos()} onBringOverdueTodos={bringOverdueTodosToToday} />;
      break;
    case "week":
      content = <WeekPage weekTodos={planner.getWeekTodos()} getTodosByDate={planner.getTodosByDate} onAdd={planner.addTodo} onToggle={toggleTodo} onDelete={planner.deleteTodo} onUpdate={updateTodo} onAddGoal={planner.addGoal} onUpdateGoal={planner.updateGoal} onToggleGoal={planner.toggleGoal} onDeleteGoal={planner.deleteGoal} categories={planner.categories} goals={planner.goals} />;
      break;
    case "month":
      content = <MonthPage todos={planner.todos} getTodosByDate={planner.getTodosByDate} onAdd={planner.addTodo} onToggle={toggleTodo} onDelete={planner.deleteTodo} onUpdate={updateTodo} categories={planner.categories} goals={planner.goals} onAddGoal={planner.addGoal} onToggleGoal={planner.toggleGoal} onDeleteGoal={planner.deleteGoal} onAddCategory={planner.addCategory} onUpdateCategory={planner.updateCategory} onDeleteCategory={planner.deleteCategory} />;
      break;
    case "projects":
      content = <ProjectPage projects={planner.projects} milestones={planner.milestones} decisions={planner.projectDecisions} todos={planner.todos} categories={planner.categories} onAddProject={planner.addProject} onUpdateProject={planner.updateProject} onDeleteProject={planner.deleteProject} onDuplicateProject={planner.duplicateProject} onArchiveProject={planner.archiveProject} onUnarchiveProject={planner.unarchiveProject} onAddMilestone={planner.addMilestone} onUpdateMilestone={planner.updateMilestone} onDeleteMilestone={planner.deleteMilestone} onAddDecision={planner.addProjectDecision} onDeleteDecision={planner.deleteProjectDecision} onAddTodo={planner.addTodo} onUpdateTodo={updateTodo} onToggleTodo={toggleTodo} />;
      break;
    case "all":
      content = <AllTodosPage allTodos={planner.allTodos} filterTodos={planner.filterTodos} tagOptions={planner.tagOptions} categories={planner.categories} projects={planner.projects} duplicateTodoIds={planner.duplicateTodoIds} onToggle={toggleTodo} onDelete={planner.deleteTodo} onDeleteMany={planner.deleteTodos} onBulkUpdate={planner.bulkUpdateTodos} onUpdate={updateTodo} onUnarchive={planner.unarchiveTodo} onAddTodo={planner.addTodo} onAddCategory={planner.addCategory} onUpdateCategory={planner.updateCategory} onDeleteCategory={planner.deleteCategory} />;
      break;
    case "memo":
      content = <MemoPage memos={planner.memos} todos={planner.allTodos} projects={planner.projects} onAdd={planner.addMemo} onUpdate={planner.updateMemo} onUpdateLinks={planner.updateMemoLinks} onDelete={planner.deleteMemo} onTogglePin={planner.toggleMemoPin} onAddTodo={planner.addTodo} />;
      break;
    case "scratchpad":
      content = <ScratchpadPage />;
      break;
    case "trash":
      content = <TrashPage onRestored={planner.loadAll} />;
      break;
    case "settings":
      content = <div className="space-y-4"><SettingsPage stats={planner.stats} categories={planner.categories} projects={planner.projects} goals={planner.goals} memos={planner.memos} plannerSettings={planner.plannerSettings} onSavePlannerSettings={planner.savePlannerSettings} onTodosCreated={planner.loadAll} apiStatus={planner.connectionError ? "offline" : "online"} /><ExportPanel todos={planner.allTodos} projects={planner.projects} goals={planner.goals} memos={planner.memos} /></div>;
      break;
  }

  return <Suspense fallback={<LoadingState />}>{content}</Suspense>;
}
