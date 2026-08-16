import { z } from "zod";

export const focusSessionInputSchema = z.object({
  todoId: z.string().optional().nullable(),
  mode: z.enum(["FOCUS", "SHORT_BREAK", "LONG_BREAK"]).default("FOCUS"),
  durationMinutes: z.coerce.number().int().min(1).max(1440),
  plannerDate: z.string().min(1),
  startedAt: z.string().min(1),
  endedAt: z.string().min(1),
  completed: z.boolean().default(true),
});

export const timerSettingsInputSchema = z.object({
  focusMinutes: z.coerce.number().int().min(1).max(180).default(25),
  shortBreakMinutes: z.coerce.number().int().min(1).max(60).default(5),
  longBreakMinutes: z.coerce.number().int().min(1).max(120).default(15),
  sessionsBeforeLongBreak: z.coerce.number().int().min(1).max(12).default(4),
  soundEnabled: z.boolean().default(true),
  notificationEnabled: z.boolean().default(false),
});

export const timeBlockInputSchema = z.object({
  todoId: z.string().optional().nullable(),
  title: z.string().trim().min(1).max(200),
  date: z.string().min(1),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  completed: z.boolean().optional(),
});
