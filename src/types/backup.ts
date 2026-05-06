import type { Goal } from "./goal";
import type { Reflection } from "./reflection";
import type { FocusSession, TimerSettings } from "./timer";
import type { Todo } from "./todo";

export type BackupData = {
  version: number;
  exportedAt: string;
  todos: Todo[];
  reflections?: Reflection[];
  goals?: Goal[];
  focusSessions?: FocusSession[];
  timerSettings?: TimerSettings;
};
