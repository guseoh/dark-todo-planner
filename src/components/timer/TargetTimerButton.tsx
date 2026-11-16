import { Play, Square } from "lucide-react";
import { isTargetRunning } from "../../lib/timeTracking";
import type { TimerTarget } from "../../types/timeTracking";
import { ElapsedClock } from "./ElapsedClock";
import { useTimeTracking } from "./TimeTrackingContext";

type Props = { target: TimerTarget; label: string; className?: string };

/** Start or stop measuring a whole category or project (time not tied to one Todo). */
export function TargetTimerButton({ target, label, className = "" }: Props) {
  const timer = useTimeTracking();
  if (!timer) return null;
  const running = isTargetRunning(timer.active, target);
  return (
    <button type="button" disabled={timer.busy} aria-pressed={running}
      className={`timer-toggle timer-toggle--target ${running ? "is-running" : ""} ${className}`}
      onClick={() => void (running ? timer.stop() : timer.start(target))}
      aria-label={`${label} 시간 측정 ${running ? "정지" : "시작"}`}
      title={running ? "측정 정지" : `${label} 전체 시간 측정 시작`}>
      {running ? <Square size={13} fill="currentColor" aria-hidden="true" /> : <Play size={14} fill="currentColor" aria-hidden="true" />}
      {running && timer.active ? <ElapsedClock startedAt={timer.active.startedAt} offsetMs={timer.offsetMs} className="text-xs font-semibold" /> : <span className="text-xs">측정</span>}
    </button>
  );
}
