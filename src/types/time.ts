export type FocusMode = "FOCUS" | "SHORT_BREAK" | "LONG_BREAK";

export type FocusSession = {
  id: string;
  userId?: string;
  todoId?: string;
  todoTitle?: string;
  mode: FocusMode;
  durationMinutes: number;
  plannerDate: string;
  startedAt: string;
  endedAt: string;
  completed: boolean;
  createdAt: string;
};

export type FocusSessionInput = {
  todoId?: string;
  mode?: FocusMode;
  durationMinutes: number;
  plannerDate: string;
  startedAt: string;
  endedAt: string;
  completed?: boolean;
};

export type TimerSettings = {
  id?: string;
  userId?: string;
  focusMinutes: number;
  shortBreakMinutes: number;
  longBreakMinutes: number;
  sessionsBeforeLongBreak: number;
  soundEnabled: boolean;
  notificationEnabled: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type TimerSettingsInput = Omit<TimerSettings, "id" | "userId" | "createdAt" | "updatedAt">;

export type TimeBlock = {
  id: string;
  userId?: string;
  todoId?: string;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  plannedMinutes: number;
  completed: boolean;
  createdAt: string;
  updatedAt: string;
};

export type TimeBlockInput = {
  todoId?: string;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  completed?: boolean;
};
