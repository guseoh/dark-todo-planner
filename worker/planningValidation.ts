import { z } from "zod";

export const dailyPlanInputSchema = z.object({
  focusText: z.string().max(2000).optional().nullable(),
  topTodoIds: z.array(z.string().min(1)).max(5).default([]),
});

