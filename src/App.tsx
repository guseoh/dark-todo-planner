import { useEffect, useMemo, useState } from "react";
import { Undo2 } from "lucide-react";
import { CommandPalette } from "./components/common/CommandPalette";
import { ErrorBanner, ErrorState, LoadingState } from "./components/common/LoadingState";
import { Modal } from "./components/common/Modal";
import { Header } from "./components/layout/Header";
import { AppView, Sidebar } from "./components/layout/Sidebar";
import { TodoForm } from "./components/todo/TodoForm";
import { usePlannerData } from "./hooks/usePlannerData";
import { AllTodosPage } from "./pages/AllTodosPage";
import { InboxPage } from "./pages/InboxPage";
import { MemoPage } from "./pages/MemoPage";
import { MonthPage } from "./pages/MonthPage";
import { PlanningHubPage } from "./pages/PlanningHubPage";
import { ProjectPage } from "./pages/ProjectPage";
import { SettingsPage } from "./pages/SettingsPage";
import { TodayPage } from "./pages/TodayPage";
import { TrashPage } from "./pages/TrashPage";
import { WeekPage } from "./pages/WeekPage";

function App({ onLogout }: { onLogout: () => Promise<void> }) {
  const [activeView, setActiveView] = useState<AppView>("today");
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const planner = usePlannerData();

  const todayTodos = useMemo(() => planner.getTodayTodos(), [planner]);
  const overdueIncompleteTodos = useMemo(() => planner.getOverdueIncompleteTodos(), [planner]);
  const weekTodos = useMemo(() => planner.getWeekTodos(), [planner]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== "k") return;
      event.preventDefault();
      if (event.shiftKey) {
        setShowCommandPalette(false);
        setShowQuickAdd(true);
      } else {
        setShowQuickAdd(false);
        setShowCommandPalette(true);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const content = {
    today: <TodayPage todayTodos={todayTodos} stats={planner.stats} onAdd={planner.addTodo} onToggle={planner.toggleTodo} onDelete={planner.deleteTodo} onUpdate={planner.updateTodo} categories={planner.categories} onAddCategory={planner.addCategory} onUpdateCategory={planner.updateCategory} onDeleteCategory={planner.deleteCategory} onReorderCategories={planner.reorderCategories} overdueTodos={overdueIncompleteTodos} onBringOverdueTodos={planner.bringOverdueTodosToToday} />,
    inbox: <InboxPage todos={planner.todos} categories={planner.categories} projects={planner.activeProjects} onAdd={planner.addTodo} onUpdate={planner.updateTodo} onDelete={planner.deleteTodo} />,
    planning: <PlanningHubPage todos={planner.allTodos} projects={planner.activeProjects} dailyPlan={planner.dailyPlan} weeklyReview={planner.weeklyReview} savedViews={planner.savedViews} taskTemplates={planner.taskTemplates} onSaveDailyPlan={planner.saveDailyPlan} onSaveWeeklyReview={planner.saveWeeklyReview} onAddSavedView={planner.addSavedView} onDeleteSavedView={planner.deleteSavedView} onAddTaskTemplate={planner.addTaskTemplate} onDeleteTaskTemplate={planner.deleteTaskTemplate} onAddTodo={planner.addTodo} focusSessions={planner.focusSessions} timeBlocks={planner.timeBlocks} timerSettings={planner.timerSettings} onAddFocusSession={planner.addFocusSession} onSaveTimerSettings={planner.saveTimerSettings} onAddTimeBlock={planner.addTimeBlock} onUpdateTimeBlock={planner.updateTimeBlock} onDeleteTimeBlock={planner.deleteTimeBlock} />,
    week: <WeekPage weekTodos={weekTodos} getTodosByDate={planner.getTodosByDate} onAdd={planner.addTodo} onToggle={planner.toggleTodo} onDelete={planner.deleteTodo} onUpdate={planner.updateTodo} onAddGoal={planner.addGoal} onUpdateGoal={planner.updateGoal} onToggleGoal={planner.toggleGoal} onDeleteGoal={planner.deleteGoal} categories={planner.categories} goals={planner.goals} />,
    month: <MonthPage todos={planner.todos} getTodosByDate={planner.getTodosByDate} onAdd={planner.addTodo} onToggle={planner.toggleTodo} onDelete={planner.deleteTodo} onUpdate={planner.updateTodo} categories={planner.categories} goals={planner.goals} onAddGoal={planner.addGoal} onToggleGoal={planner.toggleGoal} onDeleteGoal={planner.deleteGoal} onAddCategory={planner.addCategory} onUpdateCategory={planner.updateCategory} onDeleteCategory={planner.deleteCategory} />,
    projects: <ProjectPage projects={planner.projects} milestones={planner.milestones} decisions={planner.projectDecisions} memos={planner.memos} todos={planner.todos} categories={planner.categories} onAddProject={planner.addProject} onUpdateProject={planner.updateProject} onArchiveProject={planner.archiveProject} onUnarchiveProject={planner.unarchiveProject} onAddMilestone={planner.addMilestone} onUpdateMilestone={planner.updateMilestone} onDeleteMilestone={planner.deleteMilestone} onAddDecision={planner.addProjectDecision} onDeleteDecision={planner.deleteProjectDecision} onAddTodo={planner.addTodo} onUpdateTodo={planner.updateTodo} onToggleTodo={planner.toggleTodo} />,
    all: <AllTodosPage allTodos={planner.allTodos} filterTodos={planner.filterTodos} tagOptions={planner.tagOptions} categories={planner.categories} projects={planner.projects} duplicateTodoIds={planner.duplicateTodoIds} onToggle={planner.toggleTodo} onDelete={planner.deleteTodo} onDeleteMany={planner.deleteTodos} onBulkUpdate={planner.bulkUpdateTodos} onUpdate={planner.updateTodo} onUnarchive={planner.unarchiveTodo} onAddTodo={planner.addTodo} onAddCategory={planner.addCategory} onUpdateCategory={planner.updateCategory} onDeleteCategory={planner.deleteCategory} />,
    memo: <MemoPage memos={planner.memos} todos={planner.allTodos} projects={planner.projects} onAdd={planner.addMemo} onUpdate={planner.updateMemo} onUpdateLinks={planner.updateMemoLinks} onDelete={planner.deleteMemo} onTogglePin={planner.toggleMemoPin} onAddTodo={planner.addTodo} />,
    trash: <TrashPage onRestored={planner.loadAll} />,
    settings: <SettingsPage stats={planner.stats} categories={planner.categories} goals={planner.goals} memos={planner.memos} apiStatus={planner.connectionError ? "offline" : "online"} />,
  } satisfies Record<AppView, JSX.Element>;

  const openQuickAdd = () => {
    setShowCommandPalette(false);
    setShowQuickAdd(true);
  };

  return (
    <div className="min-h-screen pb-24 lg:pb-0">
      <Header storageStatus={planner.connectionError ? "offline" : "server"} onLogout={onLogout} onQuickAdd={openQuickAdd} onSearch={() => { setShowQuickAdd(false); setShowCommandPalette(true); }} />
      <div className="mx-auto flex w-full max-w-[1680px] gap-5 px-4 py-5 sm:px-5 lg:px-6">
        <Sidebar activeView={activeView} onChangeView={setActiveView} />
        <main className="min-w-0 flex-1 space-y-4">
          {planner.loading && !planner.loadedOnce ? <LoadingState /> : null}
          {!planner.loading && planner.initialLoadError ? <ErrorState message={planner.initialLoadError} onRetry={planner.loadAll} /> : null}
          {planner.loadedOnce ? <>{planner.backgroundOrOperationError ? <ErrorBanner message={planner.backgroundOrOperationError} onRetry={planner.loadAll} /> : null}{content[activeView]}</> : null}
        </main>
      </div>

      {showCommandPalette ? (
        <CommandPalette onClose={() => setShowCommandPalette(false)} onNavigate={setActiveView} onQuickAdd={openQuickAdd} todos={planner.allTodos} memos={planner.memos} projects={planner.projects} />
      ) : null}

      {showQuickAdd ? (
        <Modal title="빠른 Todo 추가" description="Ctrl+Shift+K로 열 수 있습니다. 제목에 ‘내일’, !high, #태그, 45m, due:2026-08-20 같은 빠른 문법도 사용할 수 있습니다." onClose={() => setShowQuickAdd(false)}>
          <TodoForm compact submitLabel="Todo 추가" categories={planner.categories} projects={planner.activeProjects} onAdd={(input) => { void planner.addTodo(input).then((created) => { if (created) setShowQuickAdd(false); }); }} />
        </Modal>
      ) : null}

      {planner.pendingTodoDelete || planner.pendingMemoDelete ? (
        <div className="fixed bottom-20 right-4 z-[90] flex w-[min(26rem,calc(100vw-2rem))] flex-col gap-2 lg:bottom-4" aria-live="polite">
          {planner.pendingTodoDelete ? <div className="flex items-center justify-between gap-3 rounded-xl border border-ink-600 bg-ink-900/95 px-4 py-3 shadow-2xl backdrop-blur-xl"><p className="min-w-0 truncate text-sm font-semibold text-ink-200">“{planner.pendingTodoDelete.label}” Todo 삭제 대기</p><button type="button" className="btn-secondary min-h-9 shrink-0 px-2.5 py-1 text-xs" onClick={planner.undoDeleteTodo}><Undo2 size={14} />실행 취소</button></div> : null}
          {planner.pendingMemoDelete ? <div className="flex items-center justify-between gap-3 rounded-xl border border-ink-600 bg-ink-900/95 px-4 py-3 shadow-2xl backdrop-blur-xl"><p className="min-w-0 truncate text-sm font-semibold text-ink-200">“{planner.pendingMemoDelete.label}” 메모 삭제 대기</p><button type="button" className="btn-secondary min-h-9 shrink-0 px-2.5 py-1 text-xs" onClick={planner.undoDeleteMemo}><Undo2 size={14} />실행 취소</button></div> : null}
        </div>
      ) : null}
    </div>
  );
}

export default App;
