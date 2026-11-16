import { useEffect } from "react";
import { Square } from "lucide-react";
import { getEntityColor } from "../../lib/entityColor";
import { formatClock } from "../../lib/timeTracking";
import { useTodoQuickActions } from "../todo/TodoQuickActionsContext";
import { ElapsedClock, useElapsedMs } from "./ElapsedClock";
import { useTimeTracking } from "./TimeTrackingContext";

const BASE_TITLE = "Todo Planner";

/** Always-visible running timer: category, task, elapsed time and a stop button. */
export function HeaderTimer() {
  const timer = useTimeTracking();
  const categories = useTodoQuickActions()?.categories ?? [];
  const active = timer?.active ?? null;
  const elapsed = useElapsedMs(active?.startedAt, timer?.offsetMs ?? 0);

  // Show the running time in the browser tab so it is visible from other tabs and windows.
  useEffect(() => {
    if (!active) { document.title = BASE_TITLE; return; }
    document.title = `${formatClock(elapsed)} · ${active.todoTitle}`;
    return () => { document.title = BASE_TITLE; };
  }, [active, elapsed]);

  if (!timer || !active) return null;
  const category = categories.find(({ id }) => id === active.categoryId);
  const color = category ? getEntityColor(category, categories) : "var(--text-muted)";
  return (
    <div className="header-timer" role="timer" aria-label={`시간 측정 중: ${active.todoTitle}`}>
      <span className="header-timer__dot" style={{ backgroundColor: color }} aria-hidden="true" />
      <span className="min-w-0 truncate text-xs text-ui-secondary" title={active.todoTitle}>
        {active.categoryName ?? category?.name ?? "미분류"} · {active.todoTitle}
      </span>
      <ElapsedClock startedAt={active.startedAt} offsetMs={timer.offsetMs} className="text-sm font-semibold text-ui-text" />
      <button type="button" className="header-timer__stop" onClick={() => void timer.stop()} disabled={timer.busy}
        aria-label="시간 측정 정지" title="측정 정지">
        <Square size={13} fill="currentColor" aria-hidden="true" />
      </button>
    </div>
  );
}
