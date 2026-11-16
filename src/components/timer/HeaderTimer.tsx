import { useEffect, useRef } from "react";
import { Play, Square } from "lucide-react";
import { getEntityColor } from "../../lib/entityColor";
import { formatClock } from "../../lib/timeTracking";
import type { TimerTarget } from "../../types/timeTracking";
import { useTodoQuickActions } from "../todo/TodoQuickActionsContext";
import { ElapsedClock, useElapsedMs } from "./ElapsedClock";
import { useTimeTracking } from "./TimeTrackingContext";

const BASE_TITLE = "Todo Planner";

/** Idle state: pick a category or project to measure without opening a Todo. */
function QuickStart() {
  const timer = useTimeTracking();
  const quick = useTodoQuickActions();
  const menuRef = useRef<HTMLDetailsElement>(null);
  if (!timer || !quick) return null;
  const categories = quick.categories;
  const projects = quick.projects.filter((project) => !project.archived);
  if (!categories.length && !projects.length) return null;
  const begin = (target: TimerTarget) => {
    if (menuRef.current) menuRef.current.open = false;
    void timer.start(target);
  };
  return (
    <details ref={menuRef} className="quick-timer">
      <summary className="quick-timer__summary" title="카테고리·프로젝트 시간 측정 시작" aria-label="시간 측정 시작">
        <Play size={13} fill="currentColor" aria-hidden="true" /><span className="hidden sm:inline">측정</span>
      </summary>
      <div className="quick-timer__menu" role="menu" aria-label="측정할 대상">
        {categories.length ? <p className="quick-timer__heading">카테고리</p> : null}
        {categories.map((category) => (
          <button key={category.id} type="button" role="menuitem" disabled={timer.busy} onClick={() => begin({ categoryId: category.id })}>{category.name}</button>
        ))}
        {projects.length ? <p className="quick-timer__heading">프로젝트</p> : null}
        {projects.map((project) => (
          <button key={project.id} type="button" role="menuitem" disabled={timer.busy} onClick={() => begin({ projectId: project.id })}>{project.name}</button>
        ))}
      </div>
    </details>
  );
}

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

  if (!timer) return null;
  if (!active) return <QuickStart />;
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
