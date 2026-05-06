import { useCallback, useEffect, useMemo, useState } from "react";
import { normalizeTimerSettings, normalizeTimerState, readJson, writeJson } from "../lib/storage";
import { STORAGE_KEYS } from "../lib/storageKeys";
import {
  DEFAULT_TIMER_SETTINGS,
  TIMER_MODE_LABEL,
  type FocusSession,
  type TimerMode,
  type TimerSettings,
  type TimerState,
} from "../types/timer";

const getDurationSeconds = (mode: TimerMode, settings: TimerSettings) => {
  if (mode === "FOCUS") return settings.focusMinutes * 60;
  if (mode === "SHORT_BREAK") return settings.shortBreakMinutes * 60;
  return settings.longBreakMinutes * 60;
};

const createDefaultState = (settings: TimerSettings): TimerState => ({
  mode: "FOCUS",
  isRunning: false,
  remainingSeconds: getDurationSeconds("FOCUS", settings),
  completedFocusCount: 0,
});

const beep = () => {
  const AudioContextClass =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) return;
  const audioContext = new AudioContextClass();
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  oscillator.type = "sine";
  oscillator.frequency.value = 880;
  gain.gain.value = 0.08;
  oscillator.connect(gain);
  gain.connect(audioContext.destination);
  oscillator.start();
  oscillator.stop(audioContext.currentTime + 0.18);
};

export function usePomodoroTimer(addSession: (session: Omit<FocusSession, "id">) => void) {
  const [settings, setSettings] = useState<TimerSettings>(() =>
    normalizeTimerSettings(readJson<unknown>(STORAGE_KEYS.TIMER_SETTINGS, DEFAULT_TIMER_SETTINGS)),
  );
  const [state, setState] = useState<TimerState>(() =>
    normalizeTimerState(readJson<unknown>(STORAGE_KEYS.TIMER_STATE, null), createDefaultState(settings)),
  );
  const [tick, setTick] = useState(0);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    writeJson(STORAGE_KEYS.TIMER_SETTINGS, settings);
  }, [settings]);

  useEffect(() => {
    writeJson(STORAGE_KEYS.TIMER_STATE, state);
  }, [state]);

  useEffect(() => {
    const interval = window.setInterval(() => setTick((value) => value + 1), 1000);
    return () => window.clearInterval(interval);
  }, []);

  const remainingSeconds = useMemo(() => {
    void tick;
    if (!state.isRunning || !state.startedAt) return state.remainingSeconds;
    const elapsed = Math.floor((Date.now() - new Date(state.startedAt).getTime()) / 1000);
    return Math.max(0, state.remainingSeconds - elapsed);
  }, [state.isRunning, state.remainingSeconds, state.startedAt, tick]);

  const notifyEnd = useCallback(
    (mode: TimerMode) => {
      const label = TIMER_MODE_LABEL[mode];
      setNotice(`${label} 시간이 끝났습니다.`);
      if (settings.soundEnabled) beep();
      if (settings.notificationEnabled && "Notification" in window && Notification.permission === "granted") {
        new Notification("Dark Todo Planner", { body: `${label} 시간이 끝났습니다.` });
      }
    },
    [settings.notificationEnabled, settings.soundEnabled],
  );

  const completeMode = useCallback(() => {
    const endedAt = new Date().toISOString();
    setState((current) => {
      const durationSeconds = getDurationSeconds(current.mode, settings);
      const startedAt = current.startedAt || new Date(Date.now() - durationSeconds * 1000).toISOString();
      let completedFocusCount = current.completedFocusCount;
      let nextMode: TimerMode = "FOCUS";

      addSession({
        todoId: current.selectedTodoId,
        todoTitle: current.selectedTodoTitle,
        mode: current.mode,
        durationMinutes: Math.round(durationSeconds / 60),
        startedAt,
        endedAt,
        completed: true,
      });

      if (current.mode === "FOCUS") {
        completedFocusCount += 1;
        nextMode =
          completedFocusCount % settings.sessionsBeforeLongBreak === 0 ? "LONG_BREAK" : "SHORT_BREAK";
      }

      notifyEnd(current.mode);
      return {
        ...current,
        mode: nextMode,
        isRunning: false,
        startedAt: undefined,
        pausedAt: undefined,
        remainingSeconds: getDurationSeconds(nextMode, settings),
        completedFocusCount,
      };
    });
  }, [addSession, notifyEnd, settings]);

  useEffect(() => {
    if (state.isRunning && remainingSeconds <= 0) completeMode();
  }, [completeMode, remainingSeconds, state.isRunning]);

  const start = useCallback(() => {
    setNotice("");
    setState((current) => ({
      ...current,
      isRunning: true,
      startedAt: new Date().toISOString(),
      pausedAt: undefined,
    }));
  }, []);

  const pause = useCallback(() => {
    setState((current) => ({
      ...current,
      isRunning: false,
      pausedAt: new Date().toISOString(),
      remainingSeconds,
    }));
  }, [remainingSeconds]);

  const reset = useCallback(() => {
    setNotice("");
    setState((current) => ({
      ...current,
      isRunning: false,
      startedAt: undefined,
      pausedAt: undefined,
      remainingSeconds: getDurationSeconds(current.mode, settings),
    }));
  }, [settings]);

  const switchMode = useCallback(
    (mode: TimerMode) => {
      setNotice("");
      setState((current) => ({
        ...current,
        mode,
        isRunning: false,
        startedAt: undefined,
        pausedAt: undefined,
        remainingSeconds: getDurationSeconds(mode, settings),
      }));
    },
    [settings],
  );

  const goNextMode = useCallback(() => {
    setState((current) => {
      const nextMode: TimerMode =
        current.mode === "FOCUS"
          ? (current.completedFocusCount + 1) % settings.sessionsBeforeLongBreak === 0
            ? "LONG_BREAK"
            : "SHORT_BREAK"
          : "FOCUS";
      return {
        ...current,
        mode: nextMode,
        isRunning: false,
        startedAt: undefined,
        pausedAt: undefined,
        remainingSeconds: getDurationSeconds(nextMode, settings),
      };
    });
  }, [settings]);

  const selectTodo = useCallback((todo?: { id: string; title: string }) => {
    setState((current) => ({
      ...current,
      selectedTodoId: todo?.id,
      selectedTodoTitle: todo?.title,
    }));
  }, []);

  const updateSettings = useCallback((updates: Partial<TimerSettings>) => {
    setSettings((current) => normalizeTimerSettings({ ...current, ...updates }));
    setState((current) =>
      current.isRunning
        ? current
        : {
            ...current,
            remainingSeconds: getDurationSeconds(current.mode, normalizeTimerSettings({ ...settings, ...updates })),
          },
    );
  }, [settings]);

  const requestNotificationPermission = useCallback(async () => {
    if (!("Notification" in window)) {
      setNotice("이 브라우저는 알림을 지원하지 않습니다.");
      return;
    }
    const permission = await Notification.requestPermission();
    setNotice(permission === "granted" ? "브라우저 알림이 허용되었습니다." : "브라우저 알림 권한이 허용되지 않았습니다.");
  }, []);

  return {
    state,
    settings,
    remainingSeconds,
    notice,
    start,
    pause,
    reset,
    switchMode,
    goNextMode,
    selectTodo,
    updateSettings,
    requestNotificationPermission,
  };
}
