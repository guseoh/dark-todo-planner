import { useCallback, useMemo, useState } from "react";
import { ErrorState, LoadingState } from "./components/common/LoadingState";
import { Header } from "./components/layout/Header";
import { AppView, Sidebar } from "./components/layout/Sidebar";
import { useAuth } from "./hooks/useAuth";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import { usePlannerData } from "./hooks/usePlannerData";
import { usePomodoroTimer } from "./hooks/usePomodoroTimer";
import { AllTodosPage } from "./pages/AllTodosPage";
import { ArchivePage } from "./pages/ArchivePage";
import { AuthPage } from "./pages/AuthPage";
import { CategoriesPage } from "./pages/CategoriesPage";
import { Dashboard } from "./pages/Dashboard";
import { GoalsPage } from "./pages/GoalsPage";
import { MonthPage } from "./pages/MonthPage";
import { ReflectionPage } from "./pages/ReflectionPage";
import { SettingsPage } from "./pages/SettingsPage";
import { TimerPage } from "./pages/TimerPage";
import { TodayPage } from "./pages/TodayPage";
import { WeekPage } from "./pages/WeekPage";
import type { Todo } from "./types/todo";

function App() {
  const auth = useAuth();
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

  const focusQuickAdd = useCallback(() => {
    document.querySelector<HTMLInputElement>("[data-quick-todo-input='true']")?.focus();
  }, []);

  useKeyboardShortcuts({ onChangeView: setActiveView, onFocusTodoInput: focusQuickAdd });

  if (auth.loading) {
    return (
      <div className="min-h-screen p-6">
        <LoadingState message="로그인 상태를 확인하는 중입니다." />
      </div>
    );
  }

  if (!auth.user) {
    return <AuthPage onLogin={auth.login} onRegister={auth.register} error={auth.error} />;
  }

  const content = {
    dashboard: (
      <Dashboard
        todos={planner.todos}
        todayTodos={todayTodos}
        stats={planner.stats}
        focusStats={planner.focusStats}
        nearestGoal={planner.nearestGoal}
        recentReflection={planner.recentReflection}
        onAdd={planner.addTodo}
        onToggle={planner.toggleTodo}
        onDelete={planner.deleteTodo}
        onUpdate={planner.updateTodo}
        onArchive={planner.archiveTodo}
        onFocusTodo={focusTodo}
        categories={planner.categories}
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
      />
    ),
    week: (
      <WeekPage
        weekTodos={weekTodos}
        getTodosByDate={planner.getTodosByDate}
        onAdd={planner.addTodo}
        onToggle={planner.toggleTodo}
        onDelete={planner.deleteTodo}
        onUpdate={planner.updateTodo}
        onArchive={planner.archiveTodo}
        onFocusTodo={focusTodo}
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
      />
    ),
    categories: (
      <CategoriesPage
        categories={planner.categories}
        todos={planner.todos}
        onAddCategory={planner.addCategory}
        onUpdateCategory={planner.updateCategory}
        onDeleteCategory={planner.deleteCategory}
        onAddTodo={planner.addTodo}
        onToggle={planner.toggleTodo}
        onDelete={planner.deleteTodo}
        onUpdate={planner.updateTodo}
        onArchive={planner.archiveTodo}
        onFocusTodo={focusTodo}
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
    goals: (
      <GoalsPage
        goals={planner.goals}
        onAdd={planner.addGoal}
        onUpdate={planner.updateGoal}
        onToggle={planner.toggleGoal}
        onDelete={planner.deleteGoal}
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
        todos={planner.allTodos}
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
        onLogout={auth.logout}
      />
    ),
  } satisfies Record<AppView, JSX.Element>;

  return (
    <div className="min-h-screen pb-24 lg:pb-0">
      <Header todoCount={planner.todos.length} />
      <div className="mx-auto flex max-w-7xl gap-8 px-4 py-6 sm:px-6 lg:px-8">
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
