import { useCallback, useEffect, useMemo, useState } from "react";
import { getWeekRange, isDateKeyInRange, todayKey } from "../lib/date";
import { createId } from "../lib/id";
import { readJson, validateFocusSessions, writeJson } from "../lib/storage";
import { STORAGE_KEYS } from "../lib/storageKeys";
import type { FocusSession } from "../types/timer";

export function useFocusSessions() {
  const [sessions, setSessions] = useState<FocusSession[]>(() => {
    const stored = validateFocusSessions(readJson<unknown>(STORAGE_KEYS.FOCUS_SESSIONS, []));
    return stored || [];
  });

  useEffect(() => {
    writeJson(STORAGE_KEYS.FOCUS_SESSIONS, sessions);
  }, [sessions]);

  const addSession = useCallback((session: Omit<FocusSession, "id">) => {
    setSessions((current) => [{ ...session, id: createId() }, ...current]);
  }, []);

  const replaceSessions = useCallback((nextSessions: FocusSession[]) => {
    setSessions(nextSessions);
  }, []);

  const clearSessions = useCallback(() => {
    setSessions([]);
  }, []);

  const stats = useMemo(() => {
    const focusSessions = sessions.filter((session) => session.mode === "FOCUS" && session.completed);
    const today = todayKey();
    const week = getWeekRange();

    const todaySessions = focusSessions.filter((session) => session.endedAt.slice(0, 10) === today);
    const weekSessions = focusSessions.filter((session) => isDateKeyInRange(session.endedAt.slice(0, 10), week.start, week.end));
    const sum = (items: FocusSession[]) => items.reduce((total, session) => total + session.durationMinutes, 0);

    return {
      todayMinutes: sum(todaySessions),
      todayCompletedSessions: todaySessions.length,
      weekMinutes: sum(weekSessions),
      totalMinutes: sum(focusSessions),
    };
  }, [sessions]);

  return {
    sessions,
    stats,
    addSession,
    replaceSessions,
    clearSessions,
  };
}
