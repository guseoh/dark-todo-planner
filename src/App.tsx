import { addDays } from "date-fns";
import { MoonStar, Undo2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppContent, viewsRequiringDeferredData } from "./components/app/AppContent";
import { CommandPalette } from "./components/common/CommandPalette";
import { ErrorBanner, ErrorState, LoadingState } from "./components/common/LoadingState";
import { Modal } from "./components/common/Modal";
import { Header } from "./components/layout/Header";
import { Sidebar, type AppView } from "./components/layout/Sidebar";
import { DayCloseModal, type DayCloseDecision } from "./components/today/DayCloseModal";
import { TodoForm } from "./components/todo/TodoForm";
import { TodoQuickActionsProvider, type TodoSnoozeTarget } from "./components/todo/TodoQuickActionsContext";
import { usePlannerData } from "./hooks/usePlannerData";
import { parseDateKey, todayKey, toDateKey } from "./lib/date";
import { builtInSmartViews, filterTodosBySavedView } from "./lib/planning";
import type { Todo } from "./types/todo";

const TODO_UNDO_MS = 6000;
const UNDOABLE_UPDATE_FIELDS = new Set(["date", "planningState", "priority"]);

type PendingTodoUndo = {
  snapshot: Todo;
  message: string;
  createdAt: number;
};

function App({ onLogout }: { onLogout: () => Promise<void> }) {
  const [activeView, setActiveView] = useState<AppView>("today");
  const [activeSmartViewId, setActiveSmartViewId] = useState<string | null>(null);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [showDayClose, setShowDayClose] = useState(false);
  const [openTimePlanningSignal, setOpenTimePlanningSignal] = useState(0);
  const [pendingTodoUndo, setPendingTodoUndo] = useState<PendingTodoUndo | null>(null);
  const todoUndoTimerRef = useRef<number | null>(null);
  const planner = usePlannerData();

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== "k") return;
      event.preventDefault();
      if (event.shiftKey) {
        setShowCommandPalette(false);
        setShowQuickAdd(true);
        return;
      }
      setShowQuickAdd(false);
      setShowCommandPalette(true);
      void planner.ensureDeferredData().catch(() => undefined);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [planner.ensureDeferredData]);

  useEffect(() => {
    if (!viewsRequiringDeferredData.has(activeView)) return;
    void planner.ensureDeferredData().catch(() => undefined);
  }, [activeView, planner.ensureDeferredData]);

  useEffect(() => () => {
    if (todoUndoTimerRef.current !== null) window.clearTimeout(todoUndoTimerRef.current);
  }, []);

  const registerTodoUndo = useCallback((snapshot: Todo, message: string) => {
    if (todoUndoTimerRef.current !== null) window.clearTimeout(todoUndoTimerRef.current);
    setPendingTodoUndo({ snapshot, message, createdAt: Date.now() });
    todoUndoTimerRef.current = window.setTimeout(() => {
      todoUndoTimerRef.current = null;
      setPendingTodoUndo(null);
    }, TODO_UNDO_MS);
  }, []);

  const changeView = (view: AppView) => {
    setActiveSmartViewId(null);
    setActiveView(view);
  };

  const openQuickAdd = () => {
    setShowCommandPalette(false);
    setShowQuickAdd(true);
  };

  const openSearch = () => {
    setShowQuickAdd(false);
    setShowCommandPalette(true);
    void planner.ensureDeferredData().catch(() => undefined);
  };

  const openTimePlanning = () => {
    setShowCommandPalette(false);
    setShowQuickAdd(false);
    setActiveSmartViewId(null);
    setActiveView("planning");
    setOpenTimePlanningSignal((value) => value + 1);
    void planner.ensureDeferredData().catch(() => undefined);
  };

  const openSmartView = (id: string) => {
    setActiveSmartViewId(id);
    setActiveView("planning");
    void planner.ensureDeferredData().catch(() => undefined);
  };

  const toggleTodoWithUndo: typeof planner.toggleTodo = async (id) => {
    const before = planner.allTodos.find((todo) => todo.id === id);
    if (!before) return;
    const completed = !before.completed;
    const workflowStatus = completed ? "DONE" : before.workflowStatus === "DONE" ? "TODO" : before.workflowStatus;
    const updated = await planner.updateTodo(id, { completed, workflowStatus });
    if (!updated) return;
    registerTodoUndo(before, completed ? `“${before.title}”을 완료 처리했습니다.` : `“${before.title}”을 미완료로 되돌렸습니다.`);
  };

  const updateTodoWithUndo: typeof planner.updateTodo = async (id, updates) => {
    const before = planner.allTodos.find((todo) => todo.id === id);
    const updated = await planner.updateTodo(id, updates);
    if (!before || !updated) return updated;
    const updateRecord = updates as Record<string, unknown>;
    const beforeRecord = before as unknown as Record<string, unknown>;
    const changedKeys = Object.keys(updateRecord).filter((key) => updateRecord[key] !== beforeRecord[key]);
    if (!changedKeys.length || !changedKeys.every((key) => UNDOABLE_UPDATE_FIELDS.has(key))) return updated;
    const message = changedKeys.length === 1 && changedKeys[0] === "priority"
      ? `“${before.title}”의 우선순위를 변경했습니다.`
      : `“${before.title}”의 일정을 변경했습니다.`;
    registerTodoUndo(before, message);
    return updated;
  };

  const snoozeTodo = async (todo: Todo, target: TodoSnoozeTarget) => {
    const updated = target.type === "SOMEDAY"
      ? await updateTodoWithUndo(todo.id, { planningState: "SOMEDAY" })
      : await updateTodoWithUndo(todo.id, { date: target.date, planningState: "SCHEDULED" });
    return Boolean(updated);
  };

  const undoTodoAction = async () => {
    const pending = pendingTodoUndo;
    if (!pending) return;
    if (todoUndoTimerRef.current !== null) {
      window.clearTimeout(todoUndoTimerRef.current);
      todoUndoTimerRef.current = null;
    }
    const restored = await planner.updateTodo(pending.snapshot.id, pending.snapshot);
    if (restored) {
      setPendingTodoUndo(null);
      return;
    }
    todoUndoTimerRef.current = window.setTimeout(() => {
      todoUndoTimerRef.current = null;
      setPendingTodoUndo(null);
    }, TODO_UNDO_MS);
  };

  const todayOpenTodos = planner.getTodayTodos().filter((todo) => !todo.completed && !todo.archived);
  const smartViews = useMemo(() => {
    const today = todayKey();
    return builtInSmartViews.map((view) => ({ id: view.id, label: view.name, count: filterTodosBySavedView(planner.allTodos, view.query, today).length }));
  }, [planner.allTodos]);

  const applyDayClose = async (decisions: Record<string, DayCloseDecision>) => {
    const tomorrow = toDateKey(addDays(parseDateKey(todayKey()), 1));
    let failed = 0;
    for (const todo of todayOpenTodos) {
      if (todo.repeat !== "NONE") continue;
      const decision = decisions[todo.id] || "KEEP";
      if (decision === "KEEP") continue;
      const updated = decision === "TOMORROW"
        ? await planner.updateTodo(todo.id, { date: tomorrow, planningState: "SCHEDULED" })
        : await planner.updateTodo(todo.id, { planningState: "SOMEDAY" });
      if (!updated) failed += 1;
    }
    return failed ? { ok: false, message: `${failed}개 Todo를 반영하지 못했습니다. 남은 항목을 확인한 뒤 다시 시도해주세요.` } : { ok: true };
  };

  return (
    <TodoQuickActionsProvider snoozeTodo={snoozeTodo}>
      <div className="min-h-screen pb-20 lg:pb-0">
        <Header storageStatus={planner.connectionError ? "offline" : "server"} onLogout={onLogout} onQuickAdd={openQuickAdd} onSearch={openSearch} />

        <div className="flex w-full items-start">
          <Sidebar activeView={activeView} onChangeView={changeView} onSearch={openSearch} smartViews={smartViews} activeSmartViewId={activeSmartViewId} onOpenSmartView={openSmartView} />
          <main className="min-w-0 flex-1 space-y-4 px-4 py-4 sm:px-5 lg:px-6">
            {planner.loading && !planner.loadedOnce ? <LoadingState /> : null}
            {!planner.loading && planner.initialLoadError ? <ErrorState message={planner.initialLoadError} onRetry={planner.loadAll} /> : null}
            {planner.loadedOnce ? (
              <>
                {planner.backgroundOrOperationError ? <ErrorBanner message={planner.backgroundOrOperationError} onRetry={planner.loadAll} /> : null}
                {activeView === "today" && todayOpenTodos.length ? (
                  <div className="flex justify-end">
                    <button type="button" className="btn-secondary border-accent-500/25 bg-accent-500/[0.05] text-accent-100" onClick={() => setShowDayClose(true)}>
                      <MoonStar size={15} />하루 마감 · {todayOpenTodos.length}
                    </button>
                  </div>
                ) : null}
                <AppContent activeView={activeView} planner={planner} onToggleTodo={toggleTodoWithUndo} onUpdateTodo={updateTodoWithUndo} openTimePlanningSignal={openTimePlanningSignal} openSmartViewId={activeSmartViewId} onExitSmartView={() => setActiveSmartViewId(null)} />
              </>
            ) : null}
          </main>
        </div>

        {showCommandPalette ? <CommandPalette onClose={() => setShowCommandPalette(false)} onNavigate={changeView} onQuickAdd={openQuickAdd} onOpenTimePlanning={openTimePlanning} todos={planner.allTodos} memos={planner.memos} projects={planner.projects} /> : null}

        {showQuickAdd ? (
          <Modal title="빠른 Todo 추가" description="Ctrl+Shift+K · 내일 · !high · #태그 · 45m · due:2026-08-20 같은 빠른 문법을 사용할 수 있습니다." onClose={() => setShowQuickAdd(false)}>
            <TodoForm compact submitLabel="Todo 추가" categories={planner.categories} projects={planner.activeProjects} onAdd={(input) => { void planner.addTodo(input).then((created) => { if (created) setShowQuickAdd(false); }); }} />
          </Modal>
        ) : null}

        {showDayClose ? <DayCloseModal todos={todayOpenTodos} onClose={() => setShowDayClose(false)} onApply={applyDayClose} /> : null}

        {pendingTodoUndo || planner.pendingTodoDelete || planner.pendingMemoDelete ? (
          <div className="fixed bottom-20 right-4 z-[90] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2 lg:bottom-4" aria-live="polite">
            {pendingTodoUndo ? <div className="flex items-center justify-between gap-3 rounded-lg border border-ink-600 bg-ink-900/96 px-3 py-2.5 shadow-2xl backdrop-blur-xl"><p className="min-w-0 text-sm font-semibold text-ink-200">{pendingTodoUndo.message}</p><button type="button" className="btn-secondary shrink-0 px-2.5 text-xs" onClick={() => void undoTodoAction()}><Undo2 size={14} />실행 취소</button></div> : null}
            {planner.pendingTodoDelete ? <div className="flex items-center justify-between gap-3 rounded-lg border border-ink-600 bg-ink-900/96 px-3 py-2.5 shadow-2xl backdrop-blur-xl"><p className="min-w-0 truncate text-sm font-semibold text-ink-200">“{planner.pendingTodoDelete.label}” Todo 삭제 대기</p><button type="button" className="btn-secondary shrink-0 px-2.5 text-xs" onClick={planner.undoDeleteTodo}><Undo2 size={14} />실행 취소</button></div> : null}
            {planner.pendingMemoDelete ? <div className="flex items-center justify-between gap-3 rounded-lg border border-ink-600 bg-ink-900/96 px-3 py-2.5 shadow-2xl backdrop-blur-xl"><p className="min-w-0 truncate text-sm font-semibold text-ink-200">“{planner.pendingMemoDelete.label}” 메모 삭제 대기</p><button type="button" className="btn-secondary shrink-0 px-2.5 text-xs" onClick={planner.undoDeleteMemo}><Undo2 size={14} />실행 취소</button></div> : null}
          </div>
        ) : null}
      </div>
    </TodoQuickActionsProvider>
  );
}

export default App;
