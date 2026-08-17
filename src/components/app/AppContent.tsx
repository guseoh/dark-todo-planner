import { lazy, Suspense } from "react";
import { LoadingState } from "../common/LoadingState";
import type { AppView } from "../layout/Sidebar";
import { TodayPage } from "../../pages/TodayPage";

type PlannerData = ReturnType<typeof import("../../hooks/usePlannerData").usePlannerData>;
type ToggleTodo = PlannerData["toggleTodo"];
type UpdateTodo = PlannerData["updateTodo"];

const InboxPage = lazy(() => import("../../pages/InboxPage").then((module) => ({ default: module.InboxPage })));
const PlanningHubPage = lazy(() => import("../../pages/PlanningHubPage").then((module) => ({ default: module.PlanningHubPage })));
const WeekPage = lazy(() => import("../../pages/WeekPage").then((module) => ({ default: module.WeekPage })));
const MonthPage = lazy(() => import("../../pages/MonthPage").then((module) => ({ default: module.MonthPage })));
const ProjectPage = lazy(() => import("../../pages/ProjectPage").then((module) => ({ default: module.ProjectPage })));
const InsightsPage = lazy(() => import("../../pages/InsightsPage").then((module) => ({ default: module.InsightsPage })));
const AllTodosPage = lazy(() => import("../../pages/AllTodosPage").then((module) => ({ default: module.AllTodosPage })));
const MemoPage = lazy(() => import("../../pages/MemoPage").then((module) => ({ default: module.MemoPage })));
const ScratchpadPage = lazy(() => import("../../pages/ScratchpadPage").then((module) => ({ default: module.ScratchpadPage })));
const TrashPage = lazy(() => import("../../pages/TrashPage").then((module) => ({ default: module.TrashPage })));
const SettingsPage = lazy(() => import("../../pages/SettingsPage").then((module) => ({ default: module.SettingsPage })));
const ExportPanel = lazy(() => import("../settings/ExportPanel").then((module) => ({ default: module.ExportPanel })));

export const viewsRequiringDeferredData = new Set<AppView>(["planning", "week", "month", "projects", "memo", "settings"]);

type AppContentProps = {
  activeView: AppView;
  planner: PlannerData;
  onToggleTodo?: ToggleTodo;
  onUpdateTodo?: UpdateTodo;
  openTimePlanningSignal?: number;
  openSmartViewId?: string | null;
  onExitSmartView?: () => void;
};

export function AppContent({ activeView, planner, onToggleTodo, onUpdateTodo, openTimePlanningSignal, openSmartViewId, onExitSmartView }: AppContentProps) {
  const toggleTodo = onToggleTodo ?? planner.toggleTodo;
  const updateTodo = onUpdateTodo ?? planner.updateTodo;
  let content: JSX.Element;

  switch (activeView) {
    case "today":
      content = <TodayPage todayTodos={planner.getTodayTodos()} stats={planner.stats} onAdd={planner.addTodo} onToggle={toggleTodo} onDelete={planner.deleteTodo} onUpdate={updateTodo} categories={planner.categories} projects={planner.projects} onAddCategory={planner.addCategory} onUpdateCategory={planner.updateCategory} onDeleteCategory={planner.deleteCategory} onReorderCategories={planner.reorderCategories} overdueTodos={planner.getOverdueIncompleteTodos()} onBringOverdueTodos={planner.bringOverdueTodosToToday} />;
      break;
    case "inbox":
      content = <InboxPage todos={planner.todos} categories={planner.categories} projects={planner.activeProjects} onAdd={planner.addTodo} onUpdate={updateTodo} onDelete={planner.deleteTodo} />;
      break;
    case "planning":
      content = <PlanningHubPage todos={planner.allTodos} projects={planner.activeProjects} dailyPlan={planner.dailyPlan} weeklyReview={planner.weeklyReview} savedViews={planner.savedViews} taskTemplates={planner.taskTemplates} onSaveDailyPlan={planner.saveDailyPlan} onSaveWeeklyReview={planner.saveWeeklyReview} onAddSavedView={planner.addSavedView} onDeleteSavedView={planner.deleteSavedView} onAddTaskTemplate={planner.addTaskTemplate} onDeleteTaskTemplate={planner.deleteTaskTemplate} onAddTodo={planner.addTodo} focusSessions={planner.focusSessions} timeBlocks={planner.timeBlocks} timerSettings={planner.timerSettings} openTimePlanningSignal={openTimePlanningSignal} openSmartViewId={openSmartViewId} onExitSmartView={onExitSmartView} onAddFocusSession={planner.addFocusSession} onSaveTimerSettings={planner.saveTimerSettings} onAddTimeBlock={planner.addTimeBlock} onUpdateTimeBlock={planner.updateTimeBlock} onDeleteTimeBlock={planner.deleteTimeBlock} />;
      break;
    case "week":
      content = <WeekPage weekTodos={planner.getWeekTodos()} getTodosByDate={planner.getTodosByDate} onAdd={planner.addTodo} onToggle={toggleTodo} onDelete={planner.deleteTodo} onUpdate={updateTodo} onAddGoal={planner.addGoal} onUpdateGoal={planner.updateGoal} onToggleGoal={planner.toggleGoal} onDeleteGoal={planner.deleteGoal} categories={planner.categories} goals={planner.goals} />;
      break;
    case "month":
      content = <MonthPage todos={planner.todos} getTodosByDate={planner.getTodosByDate} onAdd={planner.addTodo} onToggle={toggleTodo} onDelete={planner.deleteTodo} onUpdate={updateTodo} categories={planner.categories} goals={planner.goals} onAddGoal={planner.addGoal} onToggleGoal={planner.toggleGoal} onDeleteGoal={planner.deleteGoal} onAddCategory={planner.addCategory} onUpdateCategory={planner.updateCategory} onDeleteCategory={planner.deleteCategory} />;
      break;
    case "projects":
      content = <ProjectPage projects={planner.projects} milestones={planner.milestones} decisions={planner.projectDecisions} memos={planner.memos} todos={planner.todos} categories={planner.categories} onAddProject={planner.addProject} onUpdateProject={planner.updateProject} onDuplicateProject={planner.duplicateProject} onArchiveProject={planner.archiveProject} onUnarchiveProject={planner.unarchiveProject} onAddMilestone={planner.addMilestone} onUpdateMilestone={planner.updateMilestone} onDeleteMilestone={planner.deleteMilestone} onAddDecision={planner.addProjectDecision} onDeleteDecision={planner.deleteProjectDecision} onAddTodo={planner.addTodo} onUpdateTodo={updateTodo} onToggleTodo={toggleTodo} />;
      break;
    case "insights":
      content = <InsightsPage todos={planner.allTodos} projects={planner.projects} />;
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
      content = <div className="space-y-4"><SettingsPage stats={planner.stats} categories={planner.categories} goals={planner.goals} memos={planner.memos} plannerSettings={planner.plannerSettings} onSavePlannerSettings={planner.savePlannerSettings} apiStatus={planner.connectionError ? "offline" : "online"} /><ExportPanel todos={planner.allTodos} projects={planner.projects} goals={planner.goals} memos={planner.memos} /></div>;
      break;
  }

  return <Suspense fallback={<LoadingState />}>{content}</Suspense>;
}
