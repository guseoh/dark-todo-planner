import { Play, Square } from "lucide-react";
import type { Todo } from "../../types/todo";
import { isTargetRunning } from "../../lib/timeTracking";
import { ElapsedClock } from "./ElapsedClock";
import { useTimeTracking } from "./TimeTrackingContext";

type Props = { todo: Pick<Todo, "id" | "title" | "completed" | "archived">; className?: string };

/** Start or stop measuring a Todo; time is attributed to the Todo's category. */
export function TimerToggleButton({ todo, className = "" }: Props) {
  const timer = useTimeTracking();
  if (!timer || todo.completed || todo.archived) return null;
  const running = isTargetRunning(timer.active, { todoId: todo.id });
  return (
    <button type="button" disabled={timer.busy} aria-pressed={running}
      className={`timer-toggle ${running ? "is-running" : ""} ${className}`}
      onClick={() => void (running ? timer.stop() : timer.start(todo.id))}
      aria-label={`"${todo.title}" 시간 측정 ${running ? "정지" : "시작"}`}
      title={running ? "측정 정지" : "이 작업의 시간 측정 시작 (S)"}>
      {running ? <Square size={13} fill="currentColor" aria-hidden="true" /> : <Play size={14} fill="currentColor" aria-hidden="true" />}
      {running && timer.active ? <ElapsedClock startedAt={timer.active.startedAt} offsetMs={timer.offsetMs} className="text-xs font-semibold" /> : null}
    </button>
  );
}
