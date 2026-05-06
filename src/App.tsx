import { useCallback, useMemo, useState } from "react";
import { Header } from "./components/layout/Header";
import { AppView, Sidebar } from "./components/layout/Sidebar";
import { useFocusSessions } from "./hooks/useFocusSessions";
import { useGoals } from "./hooks/useGoals";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import { usePomodoroTimer } from "./hooks/usePomodoroTimer";
import { useReflections } from "./hooks/useReflections";
import { useTodos } from "./hooks/useTodos";
import { AllTodosPage } from "./pages/AllTodosPage";
import { ArchivePage } from "./pages/ArchivePage";
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
  const [activeView, setActiveView] = useState<AppView>("dashboard");
  const {
    todos,
    allTodos,
    archivedTodos,
    tagOptions,
    stats,
    addTodo,
    updateTodo,
    deleteTodo,
    toggleTodo,
    archiveTodo,
    unarchiveTodo,
    replaceTodos,
    clearTodos,
    getTodosByDate,
    getTodayTodos,
    getWeekTodos,
    filterTodos,
  } = useTodos();
  const focusSessions = useFocusSessions();
  const timer = usePomodoroTimer(focusSessions.addSession);
  const reflections = useReflections();
  const goals = useGoals();

  const todayTodos = useMemo(() => getTodayTodos(), [getTodayTodos]);
  const weekTodos = useMemo(() => getWeekTodos(), [getWeekTodos]);

  const focusTodo = useCallback(
    (todo: Todo) => {
      timer.selectTodo(todo);
      setActiveView("timer");
    },
    [timer],
  );

  const focusQuickAdd = useCallback(() => {
    const input = document.querySelector<HTMLInputElement>("[data-quick-todo-input='true']");
    input?.focus();
  }, []);

  useKeyboardShortcuts({ onChangeView: setActiveView, onFocusTodoInput: focusQuickAdd });

  const content = {
    dashboard: (
      <Dashboard
        todos={todos}
        todayTodos={todayTodos}
        stats={stats}
        focusStats={focusSessions.stats}
        nearestGoal={goals.nearestGoal}
        recentReflection={reflections.recentReflection}
        onAdd={addTodo}
        onToggle={toggleTodo}
        onDelete={deleteTodo}
        onUpdate={updateTodo}
        onArchive={archiveTodo}
        onFocusTodo={focusTodo}
      />
    ),
    today: (
      <TodayPage
        todayTodos={todayTodos}
        stats={stats}
        onAdd={addTodo}
        onToggle={toggleTodo}
        onDelete={deleteTodo}
        onUpdate={updateTodo}
        onArchive={archiveTodo}
        onFocusTodo={focusTodo}
      />
    ),
    week: (
      <WeekPage
        weekTodos={weekTodos}
        getTodosByDate={getTodosByDate}
        onAdd={addTodo}
        onToggle={toggleTodo}
        onDelete={deleteTodo}
        onUpdate={updateTodo}
        onArchive={archiveTodo}
        onFocusTodo={focusTodo}
      />
    ),
    month: (
      <MonthPage
        todos={todos}
        getTodosByDate={getTodosByDate}
        onAdd={addTodo}
        onToggle={toggleTodo}
        onDelete={deleteTodo}
        onUpdate={updateTodo}
        onArchive={archiveTodo}
        onFocusTodo={focusTodo}
      />
    ),
    all: (
      <AllTodosPage
        filterTodos={filterTodos}
        tagOptions={tagOptions}
        onToggle={toggleTodo}
        onDelete={deleteTodo}
        onUpdate={updateTodo}
        onArchive={archiveTodo}
        onFocusTodo={focusTodo}
      />
    ),
    timer: <TimerPage todos={todos} timer={timer} focusStats={focusSessions.stats} />,
    reflection: (
      <ReflectionPage
        reflections={reflections.reflections}
        onAdd={reflections.addReflection}
        onUpdate={reflections.updateReflection}
        onDelete={reflections.deleteReflection}
      />
    ),
    goals: (
      <GoalsPage
        goals={goals.goals}
        onAdd={goals.addGoal}
        onUpdate={goals.updateGoal}
        onToggle={goals.toggleGoal}
        onDelete={goals.deleteGoal}
      />
    ),
    archive: (
      <ArchivePage
        archivedTodos={archivedTodos}
        onToggle={toggleTodo}
        onDelete={deleteTodo}
        onUpdate={updateTodo}
        onUnarchive={unarchiveTodo}
      />
    ),
    settings: (
      <SettingsPage
        todos={allTodos}
        stats={stats}
        reflections={reflections.reflections}
        goals={goals.goals}
        focusSessions={focusSessions.sessions}
        timerSettings={timer.settings}
        onReplaceTodos={replaceTodos}
        onReplaceReflections={reflections.replaceReflections}
        onReplaceGoals={goals.replaceGoals}
        onReplaceFocusSessions={focusSessions.replaceSessions}
        onUpdateTimerSettings={timer.updateSettings}
        onRequestNotificationPermission={timer.requestNotificationPermission}
        onClearAll={() => {
          clearTodos();
          reflections.clearReflections();
          goals.clearGoals();
          focusSessions.clearSessions();
        }}
      />
    ),
  } satisfies Record<AppView, JSX.Element>;

  return (
    <div className="min-h-screen pb-24 lg:pb-0">
      <Header todoCount={todos.length} />
      <div className="mx-auto flex max-w-7xl gap-8 px-4 py-6 sm:px-6 lg:px-8">
        <Sidebar activeView={activeView} onChangeView={setActiveView} />
        <main className="min-w-0 flex-1">{content[activeView]}</main>
      </div>
    </div>
  );
}

export default App;
