import { useCallback, useEffect, useState } from "react";
import { useTimeTracking } from "../components/timer/TimeTrackingContext";
import { api, jsonBody } from "../lib/api/client";
import type { TimeEntry, TimeEntryInput } from "../types/timeTracking";

/** Measured entries for a planner-date range; refetches when the timer stops or entries change. */
export function useTimeEntries(from: string, to: string) {
  const timer = useTimeTracking();
  const version = timer?.version ?? 0;
  const bump = timer?.bump;
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let live = true;
    setError("");
    void api<{ timeEntries: TimeEntry[] }>(`/api/time-entries?from=${from}&to=${to}`)
      .then((result) => { if (live) { setEntries(result.timeEntries); setLoaded(true); } })
      .catch(() => { if (live) setError("측정 기록을 불러오지 못했습니다."); });
    return () => { live = false; };
  }, [from, to, version]);

  const create = useCallback(async (input: TimeEntryInput) => {
    await api("/api/time-entries", { method: "POST", ...jsonBody(input) });
    bump?.();
  }, [bump]);
  const update = useCallback(async (id: string, input: Pick<TimeEntryInput, "startedAt" | "endedAt" | "title" | "categoryId">) => {
    await api(`/api/time-entries/${id}`, { method: "PUT", ...jsonBody(input) });
    bump?.();
  }, [bump]);
  const remove = useCallback(async (id: string) => {
    await api(`/api/time-entries/${id}`, { method: "DELETE" });
    bump?.();
  }, [bump]);

  return { entries, loaded, error, create, update, remove };
}
