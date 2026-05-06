import { useMemo, useState } from "react";
import { Header } from "./components/layout/Header";
import { AppView, Sidebar } from "./components/layout/Sidebar";
import { useTodos } from "./hooks/useTodos";
import { Dashboard } from "./pages/Dashboard";
import { TodayPage } from "./pages/TodayPage";
import { WeekPage } from "./pages/WeekPage";
import { MonthPage } from "./pages/MonthPage";
import { AllTodosPage } from "./pages/AllTodosPage";
import { SettingsPage } from "./pages/SettingsPage";

function App() {
  const [activeView, setActiveView] = useState<AppView>("dashboard");
  const {
    todos,
    stats,
    addTodo,
    updateTodo,
    deleteTodo,
    toggleTodo,
    importTodos,
    clearTodos,
    getTodayTodos,
    getWeekTodos,
    filterTodos,
  } = useTodos();

  const todayTodos = useMemo(() => getTodayTodos(), [getTodayTodos]);
  const weekTodos = useMemo(() => getWeekTodos(), [getWeekTodos]);

  const content = {
    dashboard: (
      <Dashboard
        todos={todos}
        todayTodos={todayTodos}
        stats={stats}
        onAdd={addTodo}
        onToggle={toggleTodo}
        onDelete={deleteTodo}
        onUpdate={updateTodo}
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
      />
    ),
    week: (
      <WeekPage
        weekTodos={weekTodos}
        onAdd={addTodo}
        onToggle={toggleTodo}
        onDelete={deleteTodo}
        onUpdate={updateTodo}
      />
    ),
    month: (
      <MonthPage
        todos={todos}
        onAdd={addTodo}
        onToggle={toggleTodo}
        onDelete={deleteTodo}
        onUpdate={updateTodo}
      />
    ),
    all: (
      <AllTodosPage
        filterTodos={filterTodos}
        onToggle={toggleTodo}
        onDelete={deleteTodo}
        onUpdate={updateTodo}
      />
    ),
    settings: (
      <SettingsPage todos={todos} stats={stats} onImport={importTodos} onClear={clearTodos} />
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
