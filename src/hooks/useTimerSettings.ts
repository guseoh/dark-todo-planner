import { useCallback, useState } from "react";
import type { TimerSettings } from "../types/timer";
import { DEFAULT_TIMER_SETTINGS } from "../types/timer";
import { api, jsonBody } from "../lib/api/client";

const getMessage = (error: unknown) => (error instanceof Error ? error.message : "타이머 설정 요청 처리 중 오류가 발생했습니다.");

export function useTimerSettings() {
  const [timerSettings, setTimerSettings] = useState<TimerSettings>(DEFAULT_TIMER_SETTINGS);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const loadTimerSettings = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api<{ timerSettings: TimerSettings }>("/api/timer-settings");
      setTimerSettings(result.timerSettings);
      setError("");
      return result.timerSettings;
    } catch (err) {
      setError(getMessage(err));
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const updateTimerSettings = useCallback(async (input: Partial<TimerSettings>) => {
    const next = { ...timerSettings, ...input };
    setTimerSettings(next);
    setSaving(true);
    try {
      const result = await api<{ timerSettings: TimerSettings }>("/api/timer-settings", { method: "PUT", ...jsonBody(next) });
      setTimerSettings(result.timerSettings);
      setError("");
      return result.timerSettings;
    } catch (err) {
      setError(getMessage(err));
      return undefined;
    } finally {
      setSaving(false);
    }
  }, [timerSettings]);

  return {
    timerSettings,
    loading,
    saving,
    error,
    loadTimerSettings,
    updateTimerSettings,
  };
}
