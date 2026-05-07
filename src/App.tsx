import { useMemo, useState } from "react";
import { ErrorState, LoadingState } from "./components/common/LoadingState";
import { Header } from "./components/layout/Header";
import { AppView, Sidebar } from "./components/layout/Sidebar";
import { usePlannerData } from "./hooks/usePlannerData";
import { AllTodosPage } from "./pages/AllTodosPage";
import { ArchivePage } from "./pages/ArchivePage";
import { MonthPage } from "./pages/MonthPage";
import { ReflectionPage } from "./pages/ReflectionPage";
import { SettingsPage } from "./pages/SettingsPage";
import { TodayPage } from "./pages/TodayPage";
import { TopicsPage } from "./pages/TopicsPage";
import { WeekPage } from "./pages/WeekPage";

function App() {
  const [activeView, setActiveView] = useState<AppView>("today");
  const planner = usePlannerData();

  const todayTodos = useMemo(() => planner.getTodayTodos(), [planner]);
  const yesterdayActiveTodos = useMemo(() => planner.getYesterdayTodos().filter((todo) => !todo.completed), [planner]);
  const weekTodos = useMemo(() => planner.getWeekTodos(), [planner]);

  const content = {
    today: (
      <TodayPage
        todayTodos={todayTodos}
        stats={planner.stats}
        onAdd={planner.addTodo}
        onToggle={planner.toggleTodo}
        onDelete={planner.deleteTodo}
        onUpdate={planner.updateTodo}
        onArchive={planner.archiveTodo}
        categories={planner.categories}
        goals={planner.goals}
        onAddGoal={planner.addGoal}
        onUpdateGoal={planner.updateGoal}
        onToggleGoal={planner.toggleGoal}
        onDeleteGoal={planner.deleteGoal}
        onAddCategory={planner.addCategory}
        onUpdateCategory={planner.updateCategory}
        onDeleteCategory={planner.deleteCategory}
        yesterdayActiveCount={yesterdayActiveTodos.length}
        onBringYesterdayTodos={planner.bringYesterdayTodosToToday}
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
        categories={planner.categories}
        goals={planner.goals}
        onAddGoal={planner.addGoal}
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
        onAddTodo={planner.addTodo}
        onAddCategory={planner.addCategory}
        onUpdateCategory={planner.updateCategory}
        onDeleteCategory={planner.deleteCategory}
      />
    ),
    reflection: (
      <ReflectionPage
        reflections={planner.reflections}
        onAdd={planner.addReflection}
        onUpdate={planner.updateReflection}
        onDelete={planner.deleteReflection}
      />
    ),
    topics: (
      <TopicsPage
        topics={planner.topics}
        topicTags={planner.topicTags}
        topicCounts={planner.topicCounts}
        onAddTopic={planner.addTopic}
        onUpdateTopic={planner.updateTopic}
        onDeleteTopic={planner.deleteTopic}
        onAddTopicLink={planner.addTopicLink}
        onUpdateTopicLink={planner.updateTopicLink}
        onDeleteTopicLink={planner.deleteTopicLink}
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
        topics={planner.topics}
        musicLinks={planner.musicLinks}
        onExportBackup={planner.exportBackup}
        onImportBackup={planner.importBackup}
        onMigrateLocalStorage={planner.migrateLocalStorage}
        onAddMusicLink={planner.addMusicLink}
        onUpdateMusicLink={planner.updateMusicLink}
        onDeleteMusicLink={planner.deleteMusicLink}
        apiStatus={planner.error ? "offline" : "online"}
      />
    ),
  } satisfies Record<AppView, JSX.Element>;

  return (
    <div className="min-h-screen pb-24 lg:pb-0">
      <Header storageStatus={planner.error ? "offline" : "server"} />
      <div className="mx-auto flex w-full max-w-[1680px] gap-5 px-4 py-5 sm:px-5 lg:px-6">
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
