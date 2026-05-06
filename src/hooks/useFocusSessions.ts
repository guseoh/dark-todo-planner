import { useCallback, useMemo, useState } from "react";
import { getWeekRange, isDateKeyInRange, todayKey } from "../lib/date";
import { api, jsonBody } from "../lib/api/client";
import type { FocusSession } from "../types/timer";

const getMessage = (error: unknown) => (error instanceof Error ? error.message : "집중 기록 요청 처리 중 오류가 발생했습니다.");

export function useFocusSessions() {
  const [focusSessions, setFocusSessions] = useState<FocusSession[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const loadFocusSessions = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api<{ focusSessions: FocusSession[] }>("/api/focus-sessions");
      setFocusSessions(result.focusSessions);
      setError("");
      return result.focusSessions;
    } catch (err) {
      setError(getMessage(err));
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const addFocusSession = useCallback(async (input: Omit<FocusSession, "id">) => {
    setSaving(true);
    try {
      const result = await api<{ focusSession: FocusSession }>("/api/focus-sessions", { method: "POST", ...jsonBody(input) });
      setFocusSessions((current) => [result.focusSession, ...current]);
      setError("");
      return result.focusSession;
    } catch (err) {
      setError(getMessage(err));
      return undefined;
    } finally {
      setSaving(false);
    }
  }, []);

  const focusStats = useMemo(() => {
    const completedFocus = focusSessions.filter((session) => session.mode === "FOCUS" && session.completed);
    const today = todayKey();
    const week = getWeekRange();
    const todaySessions = completedFocus.filter((session) => session.endedAt.slice(0, 10) === today);
    const weekSessions = completedFocus.filter((session) => isDateKeyInRange(session.endedAt.slice(0, 10), week.start, week.end));
    const sum = (items: FocusSession[]) => items.reduce((total, session) => total + session.durationMinutes, 0);

    return {
      todayMinutes: sum(todaySessions),
      todayCompletedSessions: todaySessions.length,
      weekMinutes: sum(weekSessions),
      totalMinutes: sum(completedFocus),
    };
  }, [focusSessions]);

  return {
    focusSessions,
    focusStats,
    loading,
    saving,
    error,
    loadFocusSessions,
    addFocusSession,
  };
}
