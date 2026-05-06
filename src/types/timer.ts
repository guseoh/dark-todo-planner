export type TimerMode = "FOCUS" | "SHORT_BREAK" | "LONG_BREAK";

export type FocusSession = {
  id: string;
  todoId?: string;
  todoTitle?: string;
  mode: TimerMode;
  durationMinutes: number;
  startedAt: string;
  endedAt: string;
  completed: boolean;
};

export type TimerSettings = {
  focusMinutes: number;
  shortBreakMinutes: number;
  longBreakMinutes: number;
  sessionsBeforeLongBreak: number;
  soundEnabled: boolean;
  notificationEnabled: boolean;
};

export type TimerState = {
  mode: TimerMode;
  isRunning: boolean;
  startedAt?: string;
  pausedAt?: string;
  remainingSeconds: number;
  selectedTodoId?: string;
  selectedTodoTitle?: string;
  completedFocusCount: number;
};

export const TIMER_DEFAULTS = {
  FOCUS: 25,
  SHORT_BREAK: 5,
  LONG_BREAK: 15,
} as const;

export const DEFAULT_TIMER_SETTINGS: TimerSettings = {
  focusMinutes: TIMER_DEFAULTS.FOCUS,
  shortBreakMinutes: TIMER_DEFAULTS.SHORT_BREAK,
  longBreakMinutes: TIMER_DEFAULTS.LONG_BREAK,
  sessionsBeforeLongBreak: 4,
  soundEnabled: true,
  notificationEnabled: false,
};

export const TIMER_MODE_LABEL: Record<TimerMode, string> = {
  FOCUS: "집중",
  SHORT_BREAK: "짧은 휴식",
  LONG_BREAK: "긴 휴식",
};
