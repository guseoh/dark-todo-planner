import { useCallback, useMemo, useState } from "react";
import { ErrorState, LoadingState } from "./components/common/LoadingState";
import { Header } from "./components/layout/Header";
import { AppView, Sidebar } from "./components/layout/Sidebar";
import { usePlannerData } from "./hooks/usePlannerData";
import { usePomodoroTimer } from "./hooks/usePomodoroTimer";
import { AllTodosPage } from "./pages/AllTodosPage";
import { ArchivePage } from "./pages/ArchivePage";
import { Dashboard } from "./pages/Dashboard";
import { MonthPage } from "./pages/MonthPage";
import { ReflectionPage } from "./pages/ReflectionPage";
import { SettingsPage } from "./pages/SettingsPage";
import { TimerPage } from "./pages/TimerPage";
import { TodayPage } from "./pages/TodayPage";
import { WeekPage } from "./pages/WeekPage";
import type { Todo } from "./types/todo";

function App() {
  const [activeView, setActiveView] = useState<AppView>("dashboard");
  const planner = usePlannerData();
  const timer = usePomodoroTimer(planner.addFocusSession, planner.timerSettings, planner.updateTimerSettings);

  const todayTodos = useMemo(() => planner.getTodayTodos(), [planner]);
  const weekTodos = useMemo(() => planner.getWeekTodos(), [planner]);

  const focusTodo = useCallback(
    (todo: Todo) => {
      timer.selectTodo(todo);
      setActiveView("timer");
    },
    [timer],
  );

  const content = {
    dashboard: (
      <Dashboard
        todayTodos={todayTodos}
        stats={planner.stats}
        focusStats={planner.focusStats}
        onAdd={planner.addTodo}
        onToggle={planner.toggleTodo}
        onDelete={planner.deleteTodo}
        onUpdate={planner.updateTodo}
        onArchive={planner.archiveTodo}
        onFocusTodo={focusTodo}
        categories={planner.categories}
        onAddCategory={planner.addCategory}
        onUpdateCategory={planner.updateCategory}
        onDeleteCategory={planner.deleteCategory}
      />
    ),
    today: (
      <TodayPage
        todayTodos={todayTodos}
        stats={planner.stats}
        onAdd={planner.addTodo}
        onToggle={planner.toggleTodo}
        onDelete={planner.deleteTodo}
        onUpdate={planner.updateTodo}
        onArchive={planner.archiveTodo}
        onFocusTodo={focusTodo}
        categories={planner.categories}
        goals={planner.goals}
        onAddGoal={planner.addGoal}
        onUpdateGoal={planner.updateGoal}
        onToggleGoal={planner.toggleGoal}
        onDeleteGoal={planner.deleteGoal}
        onAddCategory={planner.addCategory}
        onUpdateCategory={planner.updateCategory}
        onDeleteCategory={planner.deleteCategory}
      />
    ),
    week: (
      <WeekPage
        weekTodos={weekTodos}
        getTodosByDate={planner.getTodosByDate}
        focusStats={{ weekMinutes: planner.focusStats.weekMinutes }}
        onAdd={planner.addTodo}
        onToggle={planner.toggleTodo}
        onDelete={planner.deleteTodo}
        onUpdate={planner.updateTodo}
        onArchive={planner.archiveTodo}
        onFocusTodo={focusTodo}
        onAddGoal={planner.addGoal}
        onUpdateGoal={planner.updateGoal}
        onToggleGoal={planner.toggleGoal}
        onDeleteGoal={planner.deleteGoal}
        categories={planner.categories}
        goals={planner.goals}
      />
    ),
    month: (
      <MonthPage
        todos={planner.todos}
        getTodosByDate={planner.getTodosByDate}
        onAdd={planner.addTodo}
        onToggle={planner.toggleTodo}
        onDelete={planner.deleteTodo}
        onUpdate={planner.updateTodo}
        onArchive={planner.archiveTodo}
        onFocusTodo={focusTodo}
        categories={planner.categories}
        goals={planner.goals}
        onAddGoal={planner.addGoal}
        onUpdateGoal={planner.updateGoal}
        onToggleGoal={planner.toggleGoal}
        onDeleteGoal={planner.deleteGoal}
        onAddCategory={planner.addCategory}
        onUpdateCategory={planner.updateCategory}
        onDeleteCategory={planner.deleteCategory}
      />
    ),
    all: (
      <AllTodosPage
        filterTodos={planner.filterTodos}
        tagOptions={planner.tagOptions}
        categories={planner.categories}
        onToggle={planner.toggleTodo}
        onDelete={planner.deleteTodo}
        onUpdate={planner.updateTodo}
        onArchive={planner.archiveTodo}
        onFocusTodo={focusTodo}
        onAddTodo={planner.addTodo}
        onAddCategory={planner.addCategory}
        onUpdateCategory={planner.updateCategory}
        onDeleteCategory={planner.deleteCategory}
      />
    ),
    timer: <TimerPage todos={planner.todos} timer={timer} focusStats={planner.focusStats} />,
    reflection: (
      <ReflectionPage
        reflections={planner.reflections}
        onAdd={planner.addReflection}
        onUpdate={planner.updateReflection}
        onDelete={planner.deleteReflection}
      />
    ),
    archive: (
      <ArchivePage
        archivedTodos={planner.archivedTodos}
        onToggle={planner.toggleTodo}
        onDelete={planner.deleteTodo}
        onUpdate={planner.updateTodo}
        onUnarchive={planner.unarchiveTodo}
        categories={planner.categories}
      />
    ),
    settings: (
      <SettingsPage
        stats={planner.stats}
        categories={planner.categories}
        reflections={planner.reflections}
        goals={planner.goals}
        focusSessions={planner.focusSessions}
        timerSettings={planner.timerSettings}
        onExportBackup={planner.exportBackup}
        onImportBackup={planner.importBackup}
        onMigrateLocalStorage={planner.migrateLocalStorage}
        onUpdateTimerSettings={planner.updateTimerSettings}
        onRequestNotificationPermission={timer.requestNotificationPermission}
        apiStatus={planner.error ? "offline" : "online"}
      />
    ),
  } satisfies Record<AppView, JSX.Element>;

  return (
    <div className="min-h-screen pb-24 lg:pb-0">
      <Header storageStatus={planner.error ? "offline" : "server"} />
      <div className="mx-auto flex w-full max-w-[1600px] gap-5 px-4 py-5 sm:px-5 lg:px-6">
        <Sidebar activeView={activeView} onChangeView={setActiveView} />
        <main className="min-w-0 flex-1 space-y-4">
          {planner.loading ? <LoadingState /> : null}
          {planner.error ? <ErrorState message={planner.error} onRetry={planner.loadAll} /> : null}
          {!planner.loading ? content[activeView] : null}
        </main>
      </div>
    </div>
  );
}

export default App;
