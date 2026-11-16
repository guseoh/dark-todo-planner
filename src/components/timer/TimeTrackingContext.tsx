import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { api, jsonBody } from "../../lib/api/client";
import type { ActiveTimer, TimeEntry } from "../../types/timeTracking";

type StartResponse = { activeTimer: ActiveTimer; serverNow: string; switchedFrom?: ActiveTimer; timeEntries: TimeEntry[] };
type StopResponse = { activeTimer: null; timeEntries: TimeEntry[]; capped?: boolean; discarded?: boolean; serverNow: string };

export type TimeTracking = {
  active: ActiveTimer | null;
  /** Server clock minus browser clock, so elapsed time stays right if the PC clock is off. */
  offsetMs: number;
  busy: boolean;
  /** Increments whenever stored entries change; views refetch on it. */
  version: number;
  notice: string;
  clearNotice: () => void;
  start: (todoId: string) => Promise<boolean>;
  stop: () => Promise<boolean>;
  reload: () => Promise<void>;
  bump: () => void;
  /** Daily goal in minutes (0 = none), stored in planner settings. */
  dailyGoalMinutes: number;
  setDailyGoalMinutes: (minutes: number) => Promise<boolean>;
};

export const TimeTrackingContext = createContext<TimeTracking | null>(null);
/** Null outside the provider (e.g. isolated component tests) — callers render nothing then. */
export const useTimeTracking = () => useContext(TimeTrackingContext);

export function useTimeTrackingController(goal: { dailyGoalMinutes: number; onChangeGoal: (minutes: number) => Promise<boolean> }): TimeTracking {
  const [active, setActive] = useState<ActiveTimer | null>(null);
  const [offsetMs, setOffsetMs] = useState(0);
  const [busy, setBusy] = useState(false);
  const [version, setVersion] = useState(0);
  const [notice, setNotice] = useState("");
  const busyRef = useRef(false);

  const reload = useCallback(async () => {
    try {
      const result = await api<{ activeTimer: ActiveTimer | null; serverNow: string }>("/api/timer");
      setActive(result.activeTimer);
      setOffsetMs(Date.parse(result.serverNow) - Date.now());
    } catch {
      /* Keep the last known state; the next focus event retries. */
    }
  }, []);

  useEffect(() => {
    void reload();
    // Another device or tab may have started or stopped the timer.
    const refresh = () => { if (document.visibilityState !== "hidden") void reload(); };
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, [reload]);

  const run = useCallback(async (action: () => Promise<boolean>) => {
    if (busyRef.current) return false;
    busyRef.current = true;
    setBusy(true);
    try {
      return await action();
    } catch {
      setNotice("시간 측정 요청에 실패했습니다. 연결을 확인하고 다시 시도하세요.");
      return false;
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, []);

  const start = useCallback((todoId: string) => run(async () => {
    const result = await api<StartResponse>("/api/timer/start", { method: "POST", ...jsonBody({ todoId }) });
    setActive(result.activeTimer);
    setOffsetMs(Date.parse(result.serverNow) - Date.now());
    if (result.switchedFrom) {
      setNotice(`“${result.switchedFrom.todoTitle}” 측정을 마치고 “${result.activeTimer.todoTitle}”를 시작했습니다.`);
      setVersion((value) => value + 1);
    }
    return true;
  }), [run]);

  const stop = useCallback(() => run(async () => {
    const result = await api<StopResponse>("/api/timer/stop", { method: "POST" });
    setActive(null);
    if (result.discarded) setNotice("30초 미만의 측정은 기록하지 않았습니다.");
    else if (result.capped) setNotice("12시간을 넘겨 12시간만 기록했습니다. 실제 시간에 맞게 기록을 수정하세요.");
    setVersion((value) => value + 1);
    return true;
  }), [run]);

  return {
    active, offsetMs, busy, version, notice, reload, start, stop,
    clearNotice: () => setNotice(""),
    bump: () => setVersion((value) => value + 1),
    dailyGoalMinutes: goal.dailyGoalMinutes,
    setDailyGoalMinutes: goal.onChangeGoal,
  };
}
