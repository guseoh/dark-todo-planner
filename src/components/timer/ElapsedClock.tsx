import { useEffect, useState } from "react";
import { formatClock } from "../../lib/timeTracking";

/** Elapsed time since `startedAt`; the only thing that re-renders every second. */
export function useElapsedMs(startedAt: string | undefined, offsetMs: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!startedAt) return;
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [startedAt]);
  return startedAt ? Math.max(0, now + offsetMs - Date.parse(startedAt)) : 0;
}

export function ElapsedClock({ startedAt, offsetMs, className }: { startedAt: string; offsetMs: number; className?: string }) {
  const elapsed = useElapsedMs(startedAt, offsetMs);
  return <span className={`tabular-nums ${className ?? ""}`}>{formatClock(elapsed)}</span>;
}

/**
 * Current time for totals and timelines, refreshed only while `enabled` (a timer is running).
 * These views show minutes, so a coarse tick is enough; only the clock text itself ticks every second.
 */
export function useNowMs(enabled: boolean, intervalMs = 15_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!enabled) return;
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(timer);
  }, [enabled, intervalMs]);
  return now;
}
