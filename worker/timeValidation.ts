import { z } from "zod";

export const timeBlockInputSchema = z.object({
  todoId: z.string().optional().nullable(),
  title: z.string().trim().min(1).max(200),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  completed: z.boolean().optional(),
  scheduleTodo: z.boolean().optional(),
});
