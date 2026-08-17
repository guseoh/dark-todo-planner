import { useCallback, useEffect, useRef, useState } from "react";
import { Undo2 } from "lucide-react";
import { AppContent, viewsRequiringDeferredData } from "./components/app/AppContent";
import { CommandPalette } from "./components/common/CommandPalette";
import { ErrorBanner, ErrorState, LoadingState } from "./components/common/LoadingState";
import { Modal } from "./components/common/Modal";
import { Header } from "./components/layout/Header";
import { Sidebar, type AppView } from "./components/layout/Sidebar";
import { TodoForm } from "./components/todo/TodoForm";
import { usePlannerData } from "./hooks/usePlannerData";
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
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
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
    setActiveView("planning");
    setOpenTimePlanningSignal((value) => value + 1);
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

  return (
    <div className="min-h-screen pb-20 lg:pb-0">
      <Header
        storageStatus={planner.connectionError ? "offline" : "server"}
        onLogout={onLogout}
        onQuickAdd={openQuickAdd}
        onSearch={openSearch}
      />

      <div className="flex w-full items-start">
        <Sidebar activeView={activeView} onChangeView={setActiveView} onSearch={openSearch} />
        <main className="min-w-0 flex-1 space-y-4 px-4 py-4 sm:px-5 lg:px-6">
          {planner.loading && !planner.loadedOnce ? <LoadingState /> : null}
          {!planner.loading && planner.initialLoadError ? <ErrorState message={planner.initialLoadError} onRetry={planner.loadAll} /> : null}
          {planner.loadedOnce ? (
            <>
              {planner.backgroundOrOperationError ? <ErrorBanner message={planner.backgroundOrOperationError} onRetry={planner.loadAll} /> : null}
              <AppContent
                activeView={activeView}
                planner={planner}
                onToggleTodo={toggleTodoWithUndo}
                onUpdateTodo={updateTodoWithUndo}
                openTimePlanningSignal={openTimePlanningSignal}
              />
            </>
          ) : null}
        </main>
      </div>

      {showCommandPalette ? (
        <CommandPalette
          onClose={() => setShowCommandPalette(false)}
          onNavigate={setActiveView}
          onQuickAdd={openQuickAdd}
          onOpenTimePlanning={openTimePlanning}
          todos={planner.allTodos}
          memos={planner.memos}
          projects={planner.projects}
        />
      ) : null}

      {showQuickAdd ? (
        <Modal
          title="빠른 Todo 추가"
          description="Ctrl+Shift+K · 내일 · !high · #태그 · 45m · due:2026-08-20 같은 빠른 문법을 사용할 수 있습니다."
          onClose={() => setShowQuickAdd(false)}
        >
          <TodoForm
            compact
            submitLabel="Todo 추가"
            categories={planner.categories}
            projects={planner.activeProjects}
            onAdd={(input) => {
              void planner.addTodo(input).then((created) => {
                if (created) setShowQuickAdd(false);
              });
            }}
          />
        </Modal>
      ) : null}

      {pendingTodoUndo || planner.pendingTodoDelete || planner.pendingMemoDelete ? (
        <div className="fixed bottom-20 right-4 z-[90] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2 lg:bottom-4" aria-live="polite">
          {pendingTodoUndo ? (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-ink-600 bg-ink-900/96 px-3 py-2.5 shadow-2xl backdrop-blur-xl">
              <p className="min-w-0 text-sm font-semibold text-ink-200">{pendingTodoUndo.message}</p>
              <button type="button" className="btn-secondary shrink-0 px-2.5 text-xs" onClick={() => void undoTodoAction()}>
                <Undo2 size={14} />실행 취소
              </button>
            </div>
          ) : null}
          {planner.pendingTodoDelete ? (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-ink-600 bg-ink-900/96 px-3 py-2.5 shadow-2xl backdrop-blur-xl">
              <p className="min-w-0 truncate text-sm font-semibold text-ink-200">“{planner.pendingTodoDelete.label}” Todo 삭제 대기</p>
              <button type="button" className="btn-secondary shrink-0 px-2.5 text-xs" onClick={planner.undoDeleteTodo}>
                <Undo2 size={14} />실행 취소
              </button>
            </div>
          ) : null}
          {planner.pendingMemoDelete ? (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-ink-600 bg-ink-900/96 px-3 py-2.5 shadow-2xl backdrop-blur-xl">
              <p className="min-w-0 truncate text-sm font-semibold text-ink-200">“{planner.pendingMemoDelete.label}” 메모 삭제 대기</p>
              <button type="button" className="btn-secondary shrink-0 px-2.5 text-xs" onClick={planner.undoDeleteMemo}>
                <Undo2 size={14} />실행 취소
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export default App;
