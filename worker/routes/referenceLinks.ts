import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { Hono } from "hono";
import { z } from "zod";
import { todos } from "../db/schema";
import type { Bindings, Variables } from "../types";
import { nowIso, optional } from "../utils";

const httpUrlSchema = z.string().trim().max(2048).url().refine((value) => {
  try {
    const protocol = new URL(value).protocol;
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}, "http 또는 https 링크만 사용할 수 있습니다.");

const referenceLinkInputSchema = z.object({
  url: httpUrlSchema.nullable().optional(),
  label: z.string().trim().max(80).nullable().optional(),
});

export const referenceLinkRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>();

referenceLinkRoutes.put("/todos/:id/reference-link", async (c) => {
  const input = referenceLinkInputSchema.parse(await c.req.json());
  const db = drizzle(c.env.DB);
  const id = c.req.param("id");
  const userId = c.get("userId");
  const [existing] = await db.select({ id: todos.id }).from(todos).where(and(eq(todos.id, id), eq(todos.userId, userId))).limit(1);
  if (!existing) return c.json({ message: "Todo를 찾을 수 없습니다." }, 404);

  const referenceUrl = optional(input.url);
  const referenceLabel = referenceUrl ? optional(input.label) : null;
  await db.update(todos).set({ referenceUrl, referenceLabel, updatedAt: nowIso() }).where(and(eq(todos.id, id), eq(todos.userId, userId)));
  return c.json({
    referenceUrl: referenceUrl || undefined,
    referenceLabel: referenceLabel || undefined,
  });
});
