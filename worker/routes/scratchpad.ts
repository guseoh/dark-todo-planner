import { Hono } from "hono";
import { z } from "zod";
import type { Bindings, Variables } from "../types";
import { nowIso } from "../utils";

const scratchpadInputSchema = z.object({
  content: z.string().max(1_000_000),
});

type ScratchpadRow = {
  content: string;
  updatedAt: string;
};

export const scratchpadRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>();

scratchpadRoutes.get("/scratchpad", async (c) => {
  const row = await c.env.DB.prepare(
    "SELECT content, updated_at AS updatedAt FROM scratchpads WHERE user_id = ? LIMIT 1",
  ).bind(c.get("userId")).first<ScratchpadRow>();

  return c.json({
    scratchpad: row
      ? { content: row.content, updatedAt: row.updatedAt }
      : { content: "", updatedAt: null },
  });
});

scratchpadRoutes.put("/scratchpad", async (c) => {
  const { content } = scratchpadInputSchema.parse(await c.req.json());
  const userId = c.get("userId");
  const now = nowIso();

  await c.env.DB.prepare(`
    INSERT INTO scratchpads (user_id, content, created_at, updated_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET
      content = excluded.content,
      updated_at = excluded.updated_at
  `).bind(userId, content, now, now).run();

  return c.json({ scratchpad: { content, updatedAt: now } });
});
