import { addDays } from "date-fns";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTimeTracking } from "../components/timer/TimeTrackingContext";
import { api, jsonBody } from "../lib/api/client";
import { parseDateKey, toDateKey } from "../lib/date";
import { activeAsEntry, intervalOnDay } from "../lib/timeTracking";
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

/** Measured milliseconds per planner date for a range, including the running timer on its start day. */
export function useMeasuredByDate(from: string, to: string) {
  const timer = useTimeTracking();
  const { entries } = useTimeEntries(from, to);
  const active = timer?.active ?? null;
  const offsetMs = timer?.offsetMs ?? 0;
  return useMemo(() => {
    const byDate = new Map<string, number>();
    for (const entry of entries) {
      byDate.set(entry.plannerDate, (byDate.get(entry.plannerDate) ?? 0) + Date.parse(entry.endedAt) - Date.parse(entry.startedAt));
    }
    if (active) {
      const running = activeAsEntry(active, Date.now() + offsetMs);
      for (let day = from; day <= to; day = shiftKey(day)) {
        const part = intervalOnDay(running.startedAt, running.endedAt, day);
        if (part) byDate.set(day, (byDate.get(day) ?? 0) + (part.end - part.start) * 60_000);
      }
    }
    return byDate;
  }, [active, entries, from, offsetMs, to]);
}

const shiftKey = (key: string) => toDateKey(addDays(parseDateKey(key), 1));

/** Measured minutes per project, all time or within a planner-date range (refetched when entries change). */
export function useProjectTimeTotals(range?: { from: string; to: string }) {
  const version = useTimeTracking()?.version ?? 0;
  const [totals, setTotals] = useState<Map<string, number>>(new Map());
  useEffect(() => {
    let live = true;
    const query = range ? `?from=${range.from}&to=${range.to}` : "";
    void api<{ byProject: Array<{ projectId: string; minutes: number }> }>(`/api/time-summary${query}`)
      .then((result) => { if (live) setTotals(new Map(result.byProject.map((row) => [row.projectId, row.minutes]))); })
      .catch(() => { /* totals are optional decoration */ });
    return () => { live = false; };
  }, [version, range?.from, range?.to]);
  return totals;
}
