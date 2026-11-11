import { addDays } from "date-fns";
import { Undo2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppContent, viewsRequiringDeferredData } from "./components/app/AppContent";
import { CommandPalette } from "./components/common/CommandPalette";
import { ErrorBanner, ErrorState, LoadingState } from "./components/common/LoadingState";
import { Modal } from "./components/common/Modal";
import { TodoEditModal } from "./components/todo/TodoEditModal";
import { Header } from "./components/layout/Header";
import { Sidebar, type AppView } from "./components/layout/Sidebar";
import { DayCloseModal, type DayCloseDecision } from "./components/today/DayCloseModal";
import { TodoForm } from "./components/todo/TodoForm";
import { TodoQuickActionsProvider, type TodoSnoozeTarget } from "./components/todo/TodoQuickActionsContext";
import { usePlannerData } from "./hooks/usePlannerData";
import { getPlannerToday, parseDateKey, todayKey, toDateKey } from "./lib/date";
import { calendarModeFromHash, viewFromHash, viewHash, type CalendarMode } from "./lib/viewNavigation";
import type { Todo } from "./types/todo";

const TODO_UNDO_MS = 5000;
const UNDOABLE_UPDATE_FIELDS = new Set(["date", "planningState", "priority"]);

type PendingTodoUndo = {
  changes: { id: string; updates: Partial<Todo> }[];
  message: string;
  createdAt: number;
};

function App({ onLogout }: { onLogout: () => Promise<void> }) {
  const [activeView, setActiveView] = useState<AppView>(() => viewFromHash(window.location.hash));
  const [calendarMode, setCalendarMode] = useState<CalendarMode>(() => calendarModeFromHash(window.location.hash));
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [searchTodoId, setSearchTodoId] = useState<string | null>(null);
  const [searchMemoId, setSearchMemoId] = useState<string | null>(null);
  const [searchProjectId, setSearchProjectId] = useState<string | null>(null);
  const [showTodoShortcuts, setShowTodoShortcuts] = useState(false);
  const [showDayClose, setShowDayClose] = useState(false);
  const [pendingTodoUndo, setPendingTodoUndo] = useState<PendingTodoUndo | null>(null);
  const undoInProgress = useRef(false);
  const todoUndoTimerRef = useRef<number | null>(null);
  const lastPlannerDayRef = useRef(getPlannerToday());
  const planner = usePlannerData();

  useEffect(() => {
    // pushState doesn't emit popstate: clicks update state immediately, while
    // Back/Forward or manually edited hashes restore the selected view.
    const syncLocation = () => {
      if (window.location.hash === "#/inbox") window.history.replaceState(window.history.state, "", "#/all");
      const next = viewFromHash(window.location.hash);
      setSearchMemoId(null);
      setSearchProjectId(null);
      setSearchTodoId(null);
      setActiveView(next);
      setCalendarMode(calendarModeFromHash(window.location.hash));
    };
    syncLocation(); // Normalize old Inbox bookmarks on initial load.
    window.addEventListener("popstate", syncLocation);
    window.addEventListener("hashchange", syncLocation);
    return () => {
      window.removeEventListener("popstate", syncLocation);
      window.removeEventListener("hashchange", syncLocation);
    };
  }, []);

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
    const handleTodoNavigation = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.isComposing || event.ctrlKey || event.metaKey || event.altKey) return;
      if (!(event.target instanceof Element) || event.target.closest("input, textarea, select, [contenteditable]:not([contenteditable=false])")) return;
      if (document.querySelector('[aria-modal="true"]')) return;
      const rows = Array.from(document.querySelectorAll<HTMLElement>("main [data-todo-row]"))
        .filter((row) => row.getClientRects().length > 0);
      if (!rows.length) return;
      const key = event.key.toLowerCase();
      if (key === "?") {
        setShowTodoShortcuts(true);
      } else if (key === "j" || key === "k") {
        const current = rows.findIndex((row) => row.contains(document.activeElement));
        const index = current < 0 ? (key === "j" ? 0 : rows.length - 1)
          : Math.max(0, Math.min(rows.length - 1, current + (key === "j" ? 1 : -1)));
        rows[index].focus();
      } else return;
      event.preventDefault();
    };
    window.addEventListener("keydown", handleTodoNavigation);
    return () => window.removeEventListener("keydown", handleTodoNavigation);
  }, []);

  useEffect(() => {
    if (!viewsRequiringDeferredData.has(activeView)) return;
    void planner.ensureDeferredData().catch(() => undefined);
  }, [activeView, planner.ensureDeferredData]);

  useEffect(() => {
    if (activeView !== "today") return;
    const media = window.matchMedia("(min-width: 1280px)");
    const load = () => { if (media.matches) void planner.loadGoals().catch(() => undefined); };
    load();
    media.addEventListener("change", load);
    return () => media.removeEventListener("change", load);
  }, [activeView, planner.loadGoals]);

  // A tab can remain open across the 03:00 planner-day boundary.
  // Refresh views and stats on the next minute or when the tab becomes visible.
  useEffect(() => {
    const refreshIfDayChanged = () => {
      if (document.visibilityState === "hidden") return;
      const nextDay = getPlannerToday();
      if (nextDay === lastPlannerDayRef.current) return;
      lastPlannerDayRef.current = nextDay;
      void planner.loadAll().catch(() => undefined);
    };
    const interval = window.setInterval(refreshIfDayChanged, 60_000);
    document.addEventListener("visibilitychange", refreshIfDayChanged);
    window.addEventListener("focus", refreshIfDayChanged);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", refreshIfDayChanged);
      window.removeEventListener("focus", refreshIfDayChanged);
    };
  }, [planner.loadAll]);

  useEffect(() => () => {
    if (todoUndoTimerRef.current !== null) window.clearTimeout(todoUndoTimerRef.current);
  }, []);

  const registerTodoUndo = useCallback((changes: PendingTodoUndo["changes"], message: string) => {
    if (!changes.length) return;
    if (todoUndoTimerRef.current !== null) window.clearTimeout(todoUndoTimerRef.current);
    setPendingTodoUndo({ changes, message, createdAt: Date.now() });
    todoUndoTimerRef.current = window.setTimeout(() => {
      todoUndoTimerRef.current = null;
      setPendingTodoUndo(null);
    }, TODO_UNDO_MS);
  }, []);

  const navigateToView = (view: AppView, mode: CalendarMode = "month") => {
    const target = viewHash(view, mode);
    if (window.location.hash !== target) {
      window.history.pushState({ view, mode }, "", target);
    }
    setActiveView(view);
    if (view === "calendar") setCalendarMode(mode);
  };

  const changeCalendarMode = (mode: CalendarMode) => navigateToView("calendar", mode);

  const changeView = (view: AppView) => {
    setSearchMemoId(null);
    setSearchProjectId(null);
    setSearchTodoId(null);
    navigateToView(view);
  };

  const clearOpenedSearchTarget = useCallback((kind: "메모" | "프로젝트") => {
    if (kind === "메모") setSearchMemoId(null);
    else setSearchProjectId(null);
  }, []);

  const openSearchResult = (kind: "Todo" | "메모" | "프로젝트", id: string) => {
    setSearchTodoId(kind === "Todo" ? id : null);
    setSearchMemoId(kind === "메모" ? id : null);
    setSearchProjectId(kind === "프로젝트" ? id : null);
    navigateToView(kind === "Todo" ? "all" : kind === "메모" ? "memo" : "projects");
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

  const toggleTodoWithUndo: typeof planner.toggleTodo = async (id) => {
    const before = planner.allTodos.find((todo) => todo.id === id);
    if (!before) return false;
    const completed = !before.completed;
    const toggled = await planner.toggleTodo(id);
    if (!toggled) return false;
    registerTodoUndo([{ id, updates: { completed: before.completed, workflowStatus: before.workflowStatus } }], completed ? `“${before.title}”을 완료 처리했습니다.` : `“${before.title}”을 미완료로 되돌렸습니다.`);
    return true;
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
    registerTodoUndo([{ id, updates: Object.fromEntries(changedKeys.map((key) => [key, beforeRecord[key]])) }], message);
    return updated;
  };

  const bulkUpdateWithUndo: typeof planner.bulkUpdateTodos = async (ids, action) => {
    const targetIds = new Set(ids);
    const changes = planner.allTodos.filter(({ id }) => targetIds.has(id)).map((todo) => {
      let updates: Partial<Todo>;
      switch (action.type) {
        case "DATE": updates = { date: todo.date, planningState: todo.planningState }; break;
        case "PRIORITY": updates = { priority: todo.priority }; break;
        case "WORKFLOW_STATUS": updates = { workflowStatus: todo.workflowStatus, completed: todo.completed }; break;
        case "PROJECT": updates = { projectId: todo.projectId, milestoneId: todo.milestoneId, parentTodoId: todo.parentTodoId }; break;
      }
      return { id: todo.id, updates };
    });
    const success = await planner.bulkUpdateTodos(ids, action);
    if (success) registerTodoUndo(changes, `할 일 ${changes.length}개를 변경했습니다.`);
    return success;
  };

  const snoozeTodo = async (todo: Todo, target: TodoSnoozeTarget) => {
    const updated = target.type === "SOMEDAY"
      ? await updateTodoWithUndo(todo.id, { planningState: "SOMEDAY" })
      : await updateTodoWithUndo(todo.id, { date: target.date, planningState: "SCHEDULED" });
    return Boolean(updated);
  };

  const undoTodoAction = async () => {
    const pending = pendingTodoUndo;
    if (!pending || undoInProgress.current) return;
    undoInProgress.current = true;
    try {
      const results = await Promise.all(pending.changes.map(async (change) =>
        await planner.updateTodo(change.id, change.updates) ? null : change));
      const failed = results.filter((change): change is NonNullable<typeof change> => change !== null);
      setPendingTodoUndo((current) => {
        if (current !== pending) return current;
        return failed.length ? { ...pending, changes: failed, message: "일부 작업을 복구하지 못했습니다." } : null;
      });
    } finally {
      undoInProgress.current = false;
    }
  };

  const pendingDelete = planner.pendingTodoDelete;
  const showDeleteUndo = pendingDelete && (!pendingTodoUndo || pendingDelete.createdAt >= pendingTodoUndo.createdAt);
  const latestTodoActionAt = Math.max(pendingDelete?.createdAt ?? 0, pendingTodoUndo?.createdAt ?? 0);
  const pendingMemo = planner.pendingMemoDelete;
  const showMemoUndo = pendingMemo && pendingMemo.createdAt >= latestTodoActionAt;
  const showUpdateUndo = pendingTodoUndo && !showDeleteUndo && !showMemoUndo;

  const todayOpenTodos = planner.getTodayTodos().filter((todo) => !todo.completed && !todo.archived);
  const searchTodo = searchTodoId ? planner.allTodos.find((todo) => todo.id === searchTodoId) || null : null;

  const applyDayClose = async (decisions: Record<string, DayCloseDecision>) => {
    const tomorrow = toDateKey(addDays(parseDateKey(todayKey()), 1));
    let failed = 0;
    for (const todo of todayOpenTodos) {
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
    <TodoQuickActionsProvider snoozeTodo={snoozeTodo} projects={planner.projects} categories={planner.categories}>
      <div className="min-h-screen pb-20 sm:pb-0">
        <Header storageStatus={planner.connectionError ? "offline" : "server"} onLogout={onLogout} onQuickAdd={openQuickAdd} onSearch={openSearch} activeView={activeView} />

        <div className="flex w-full items-start">
          <Sidebar activeView={activeView} onChangeView={changeView} onSearch={openSearch} />
          <main className="min-w-0 flex-1 space-y-4 px-4 py-4 sm:px-5 lg:px-6 xl:px-8">
            {planner.loading && !planner.loadedOnce ? <LoadingState /> : null}
            {!planner.loading && planner.initialLoadError ? <ErrorState message={planner.initialLoadError} onRetry={planner.loadAll} /> : null}
            {planner.loadedOnce ? (
              <>
                {planner.backgroundOrOperationError ? <ErrorBanner message={planner.backgroundOrOperationError} onRetry={planner.loadAll} /> : null}
                <AppContent activeView={activeView} calendarMode={calendarMode} onCalendarModeChange={changeCalendarMode} planner={planner} onToggleTodo={toggleTodoWithUndo} onUpdateTodo={updateTodoWithUndo} onBulkUpdateTodos={bulkUpdateWithUndo} focusedMemoId={searchMemoId} focusedProjectId={searchProjectId} onFocusedItemOpened={clearOpenedSearchTarget} onOpenDayClose={() => setShowDayClose(true)} />
              </>
            ) : null}
          </main>
        </div>

        {showCommandPalette ? <CommandPalette onClose={() => setShowCommandPalette(false)} onNavigate={changeView} onQuickAdd={openQuickAdd} onOpenItem={openSearchResult} todos={planner.allTodos} memos={planner.memos} projects={planner.projects} /> : null}

        {showQuickAdd ? (
          <Modal title="빠른 Todo 추가" description="Ctrl+Shift+K · 내일 · !high · @프로젝트 · +카테고리 · due:2026-08-20 같은 빠른 문법을 사용할 수 있습니다." onClose={() => setShowQuickAdd(false)}>
            <TodoForm compact submitLabel="Todo 추가" categories={planner.categories} projects={planner.activeProjects} onAdd={async (input) => { const created = await planner.addTodo(input); if (created) setShowQuickAdd(false); return created; }} />
          </Modal>
        ) : null}

        {searchTodo ? <TodoEditModal todo={searchTodo} categories={planner.categories} projects={planner.activeProjects} onClose={() => setSearchTodoId(null)} onSave={updateTodoWithUndo} /> : null}

        {showDayClose ? <DayCloseModal todos={todayOpenTodos} onClose={() => setShowDayClose(false)} onApply={applyDayClose} /> : null}
        {showTodoShortcuts ? (
          <Modal title="할 일 단축키" onClose={() => setShowTodoShortcuts(false)}>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
              <dt>j / k</dt><dd>다음 / 이전 할 일 선택</dd>
              <dt>x</dt><dd>완료 상태 전환</dd>
              <dt>t</dt><dd>오늘로 이동</dd>
              <dt>e</dt><dd>수정</dd>
              <dt>Delete</dt><dd>삭제</dd>
              <dt>f</dt><dd>오늘 화면에서 집중 작업에 넣기 / 빼기</dd>
            </dl>
          </Modal>
        ) : null}

        {pendingTodoUndo || pendingDelete || planner.pendingMemoDelete ? (
          <div className="fixed bottom-20 right-4 z-[90] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2 lg:bottom-4" aria-live="polite">
            {showDeleteUndo && !showMemoUndo ? <div className="flex items-center justify-between gap-3 rounded-lg border border-ui-divider bg-ui-elevated px-3 py-2.5"><p className="min-w-0 text-sm">“{pendingDelete.label}” 항목을 삭제했습니다.</p><button type="button" className="btn-secondary shrink-0 px-2.5 text-xs" onClick={planner.undoDeleteTodo}><Undo2 size={14} />되돌리기</button></div> : null}
            {showUpdateUndo ? <div className="flex items-center justify-between gap-3 rounded-lg border border-ink-600 bg-ui-elevated px-3 py-2.5"><p className="min-w-0 text-sm font-semibold text-ui-text">{pendingTodoUndo.message}</p><button type="button" className="btn-secondary shrink-0 px-2.5 text-xs" onClick={() => void undoTodoAction()}><Undo2 size={14} />되돌리기</button></div> : null}
            {showMemoUndo ? <div className="flex items-center justify-between gap-3 rounded-lg border border-ink-600 bg-ink-900/96 px-3 py-2.5 shadow-2xl backdrop-blur-xl"><p className="min-w-0 truncate text-sm font-semibold text-ink-200">“{pendingMemo.label}” 메모 삭제 대기</p><button type="button" className="btn-secondary shrink-0 px-2.5 text-xs" onClick={planner.undoDeleteMemo}><Undo2 size={14} />실행 취소</button></div> : null}
          </div>
        ) : null}
      </div>
    </TodoQuickActionsProvider>
  );
}

export default App;
