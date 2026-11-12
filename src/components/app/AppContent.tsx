import { lazy, Suspense } from "react";
import { api, jsonBody } from "../../lib/api/client";
import { getPlannerToday } from "../../lib/date";
import { selectTodayCandidates, isTodayPlanningCandidate } from "../../lib/todayPlanning";
import type { Todo } from "../../types/todo";
import { prepareOverdueBulkImport } from "../../lib/todoBulkImport";
import type { OverdueTodoImportMode, OverdueTodoImportResult } from "../../lib/todoRecovery";
import { LoadingState } from "../common/LoadingState";
import { CalendarPage } from "../../pages/CalendarPage";
import type { CalendarMode } from "../../lib/viewNavigation";
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
const ActivityPage = lazy(() => import("../../pages/ActivityPage").then((module) => ({ default: module.ActivityPage })));
const TrashPage = lazy(() => import("../../pages/TrashPage").then((module) => ({ default: module.TrashPage })));
const SettingsPage = lazy(() => import("../../pages/SettingsPage").then((module) => ({ default: module.SettingsPage })));

export const viewsRequiringDeferredData = new Set<AppView>(["calendar", "projects", "memo", "settings"]);

type AppContentProps = {
  activeView: AppView;
  calendarMode: CalendarMode;
  calendarDate: string;
  onCalendarDateChange: (date: string) => void;
  onCalendarModeChange: (mode: CalendarMode) => void;
  planner: PlannerData;
  onToggleTodo?: ToggleTodo;
  onUpdateTodo?: UpdateTodo;
  onBulkUpdateTodos?: PlannerData["bulkUpdateTodos"];
  focusedMemoId?: string | null;
  focusedProjectId?: string | null;
  onFocusedItemOpened?: (kind: "메모" | "프로젝트") => void;
  onOpenDayClose?: () => void;
  onDetachTodo: (id: string, projectId: string, includeChildren: boolean) => Promise<boolean>;
  onOpenProjectTodos: (projectId: string) => void;
  onOpenTodo: (id: string) => void;
  allProjectId: string;
};

export function AppContent({ activeView, calendarMode, calendarDate, onCalendarDateChange, onCalendarModeChange, planner, onToggleTodo, onUpdateTodo, onBulkUpdateTodos, focusedMemoId, focusedProjectId, onFocusedItemOpened, onOpenDayClose, onDetachTodo, onOpenProjectTodos, onOpenTodo, allProjectId }: AppContentProps) {
  const toggleTodo = onToggleTodo ?? planner.toggleTodo;
  const updateTodo = onUpdateTodo ?? planner.updateTodo;
  const bulkUpdateTodos = onBulkUpdateTodos ?? planner.bulkUpdateTodos;

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
        const success = await bulkUpdateTodos(prepared.ids, { type: "DATE", value: today });
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

  const planExistingTodoForToday = async (todo: Todo): Promise<boolean> => {
    const plannerToday = getPlannerToday();
    if (!isTodayPlanningCandidate(todo, plannerToday)) return false;
    const updated = await updateTodo(todo.id, { date: plannerToday, planningState: "SCHEDULED" });
    // Only the execution date changes: dueDate, project and milestone are preserved.
    return Boolean(updated);
  };

  let content: JSX.Element;

  switch (activeView) {
    case "today":
      content = <TodayPage todayTodos={planner.getTodayTodos()}
        rail={{ todos: planner.todos, goals: planner.goals, dueSoonDays: planner.plannerSettings?.reminderDueSoonDays ?? 3,
          onAddGoal: planner.addGoal, onUpdateGoal: planner.updateGoal, onToggleGoal: planner.toggleGoal,
          onDeleteGoal: planner.deleteGoal, onReload: planner.loadTodos }}
        onMoveOverdue={(date) => bulkUpdateTodos(planner.getOverdueIncompleteTodos().map(({ id }) => id), { type: "DATE", value: date })}
        candidateTodos={selectTodayCandidates(planner.todos, getPlannerToday())} onPlanTodoToToday={planExistingTodoForToday}
        onOpenDayClose={onOpenDayClose} stats={planner.stats} onAdd={planner.addTodo} onToggle={toggleTodo} onDelete={planner.deleteTodo} onDeleteMany={planner.deleteTodos} onUpdate={updateTodo} onReorderTodos={planner.reorderTodos} categories={planner.categories} projects={planner.projects} onAddCategory={planner.addCategory} onUpdateCategory={planner.updateCategory} onDeleteCategory={planner.deleteCategory} onReorderCategories={planner.reorderCategories} overdueTodos={planner.getOverdueIncompleteTodos()} onBringOverdueTodos={bringOverdueTodosToToday} />;
      break;
    case "calendar":
      content = (
        <CalendarPage mode={calendarMode} onModeChange={onCalendarModeChange}>
          {calendarMode === "week" ? (
            <WeekPage embedded selectedDate={calendarDate} onSelectDate={onCalendarDateChange} onReloadTodos={async () => { await planner.loadTodos(); }} todos={planner.todos} projects={planner.projects} getTodosByDate={planner.getTodosByDate} onAdd={planner.addTodo} onToggle={toggleTodo} onDelete={planner.deleteTodo} onUpdate={updateTodo} onAddGoal={planner.addGoal} onUpdateGoal={planner.updateGoal} onToggleGoal={planner.toggleGoal} onDeleteGoal={planner.deleteGoal} categories={planner.categories} goals={planner.goals} />
          ) : (
            <MonthPage embedded selectedDate={calendarDate} onSelectDate={onCalendarDateChange} todos={planner.todos} projects={planner.projects} milestones={planner.milestones} getTodosByDate={planner.getTodosByDate} onAdd={planner.addTodo} onToggle={toggleTodo} onDelete={planner.deleteTodo} onUpdate={updateTodo} categories={planner.categories} goals={planner.goals} onAddGoal={planner.addGoal} onToggleGoal={planner.toggleGoal} onDeleteGoal={planner.deleteGoal} onAddCategory={planner.addCategory} onUpdateCategory={planner.updateCategory} onDeleteCategory={planner.deleteCategory} />
          )}
        </CalendarPage>
      );
      break;
    case "projects":
      content = <ProjectPage focusedProjectId={focusedProjectId} onSearchTargetOpened={() => onFocusedItemOpened?.("프로젝트")} projects={planner.projects} milestones={planner.milestones} decisions={planner.projectDecisions} todos={planner.todos} categories={planner.categories} onAddProject={planner.addProject} onUpdateProject={planner.updateProject} onDeleteProject={planner.deleteProject} onDuplicateProject={planner.duplicateProject} onArchiveProject={planner.archiveProject} onUnarchiveProject={planner.unarchiveProject} onAddMilestone={planner.addMilestone} onUpdateMilestone={planner.updateMilestone} onDeleteMilestone={planner.deleteMilestone} onAddDecision={planner.addProjectDecision} onDeleteDecision={planner.deleteProjectDecision} onAddTodo={planner.addTodo} onUpdateTodo={updateTodo} onToggleTodo={toggleTodo} onDeleteTodo={planner.deleteTodo} onDetachTodo={onDetachTodo} onOpenProjectTodos={onOpenProjectTodos} />;
      break;
    case "all":
      content = <AllTodosPage key={allProjectId} initialProjectId={allProjectId} allTodos={planner.allTodos} filterTodos={planner.filterTodos} categories={planner.categories} projects={planner.projects} duplicateTodoIds={planner.duplicateTodoIds} onToggle={toggleTodo} onDelete={planner.deleteTodo} onDeleteMany={planner.deleteTodos} onBulkUpdate={bulkUpdateTodos} onUpdate={updateTodo} onUnarchive={planner.unarchiveTodo} onAddTodo={planner.addTodo} onAddCategory={planner.addCategory} onUpdateCategory={planner.updateCategory} onDeleteCategory={planner.deleteCategory} />;
      break;
    case "memo":
      content = <MemoPage focusedMemoId={focusedMemoId} onSearchTargetOpened={() => onFocusedItemOpened?.("메모")} memos={planner.memos} todos={planner.allTodos} projects={planner.projects} onAdd={planner.addMemo} onUpdate={planner.updateMemo} onUpdateLinks={planner.updateMemoLinks} onDelete={planner.deleteMemo} onTogglePin={planner.toggleMemoPin} onAddTodo={planner.addTodo} />;
      break;
    case "scratchpad":
      content = <ScratchpadPage />;
      break;
    case "activity":
      content = <ActivityPage />;
      break;
    case "trash":
      content = <TrashPage onRestored={planner.loadAll} onOpenTodo={onOpenTodo} />;
      break;
    case "settings":
      content = <SettingsPage stats={planner.stats} categories={planner.categories} projects={planner.projects} goals={planner.goals} memos={planner.memos} todos={planner.allTodos} plannerSettings={planner.plannerSettings} onSavePlannerSettings={planner.savePlannerSettings} onTodosCreated={planner.loadAll} apiStatus={planner.connectionError ? "offline" : "online"} />;
      break;
    default: {
      const unreachable: never = activeView;
      throw new Error(`지원하지 않는 화면: ${unreachable}`);
    }
  }

  return <Suspense fallback={<LoadingState />}>{content}</Suspense>;
}
