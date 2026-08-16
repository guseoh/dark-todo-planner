import { useCallback, useState } from "react";
import { api, jsonBody } from "../lib/api/client";
import { todayKey } from "../lib/date";
import type { FocusSession, FocusSessionInput, TimeBlock, TimeBlockInput, TimerSettings, TimerSettingsInput } from "../types/time";

const getMessage = (error: unknown) => error instanceof Error ? error.message : "시간 계획 데이터를 처리하지 못했습니다.";

export function useTimePlanning() {
  const [focusSessions, setFocusSessions] = useState<FocusSession[]>([]);
  const [timeBlocks, setTimeBlocks] = useState<TimeBlock[]>([]);
  const [timerSettings, setTimerSettings] = useState<TimerSettings>({
    focusMinutes: 25,
    shortBreakMinutes: 5,
    longBreakMinutes: 15,
    sessionsBeforeLongBreak: 4,
    soundEnabled: true,
    notificationEnabled: false,
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const loadTimePlanning = useCallback(async () => {
    setLoading(true);
    try {
      const today = todayKey();
      const [sessionResult, blockResult, settingsResult] = await Promise.all([
        api<{ focusSessions: FocusSession[] }>(`/api/focus-sessions?date=${today}`),
        api<{ timeBlocks: TimeBlock[] }>(`/api/time-blocks?date=${today}`),
        api<{ timerSettings: TimerSettings }>("/api/timer-settings"),
      ]);
      setFocusSessions(sessionResult.focusSessions);
      setTimeBlocks(blockResult.timeBlocks);
      setTimerSettings(settingsResult.timerSettings);
      setError("");
    } catch (err) {
      setError(getMessage(err));
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const addFocusSession = useCallback(async (input: FocusSessionInput) => {
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

  const saveTimerSettings = useCallback(async (input: TimerSettingsInput) => {
    setSaving(true);
    try {
      const result = await api<{ timerSettings: TimerSettings }>("/api/timer-settings", { method: "PUT", ...jsonBody(input) });
      setTimerSettings(result.timerSettings);
      setError("");
      return result.timerSettings;
    } catch (err) {
      setError(getMessage(err));
      return undefined;
    } finally {
      setSaving(false);
    }
  }, []);

  const addTimeBlock = useCallback(async (input: TimeBlockInput) => {
    setSaving(true);
    try {
      const result = await api<{ timeBlock: TimeBlock }>("/api/time-blocks", { method: "POST", ...jsonBody(input) });
      setTimeBlocks((current) => [...current, result.timeBlock].sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime)));
      setError("");
      return result.timeBlock;
    } catch (err) {
      setError(getMessage(err));
      return undefined;
    } finally {
      setSaving(false);
    }
  }, []);

  const updateTimeBlock = useCallback(async (id: string, input: TimeBlockInput) => {
    setSaving(true);
    try {
      const result = await api<{ timeBlock: TimeBlock }>(`/api/time-blocks/${id}`, { method: "PUT", ...jsonBody(input) });
      setTimeBlocks((current) => current.map((block) => block.id === id ? result.timeBlock : block).sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime)));
      setError("");
      return result.timeBlock;
    } catch (err) {
      setError(getMessage(err));
      return undefined;
    } finally {
      setSaving(false);
    }
  }, []);

  const deleteTimeBlock = useCallback(async (id: string) => {
    const previous = timeBlocks;
    setTimeBlocks((current) => current.filter((block) => block.id !== id));
    try {
      await api(`/api/time-blocks/${id}`, { method: "DELETE" });
      setError("");
      return true;
    } catch (err) {
      setTimeBlocks(previous);
      setError(getMessage(err));
      return false;
    }
  }, [timeBlocks]);

  return {
    focusSessions,
    timeBlocks,
    timerSettings,
    loading,
    saving,
    error,
    loadTimePlanning,
    addFocusSession,
    saveTimerSettings,
    addTimeBlock,
    updateTimeBlock,
    deleteTimeBlock,
  };
}
