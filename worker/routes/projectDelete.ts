import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { Hono } from "hono";
import { projects } from "../db/schema";
import type { Bindings, Variables } from "../types";

export const projectDeleteRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>();

projectDeleteRoutes.delete("/projects/:id", async (c) => {
  const db = drizzle(c.env.DB);
  const id = c.req.param("id");
  const userId = c.get("userId");
  const [existing] = await db
    .select({ id: projects.id })
    .from(projects)
    .where(and(eq(projects.id, id), eq(projects.userId, userId)))
    .limit(1);

  if (!existing) return c.json({ message: "프로젝트를 찾을 수 없습니다." }, 404);

  await db.delete(projects).where(and(eq(projects.id, id), eq(projects.userId, userId)));
  return c.json({ ok: true });
});
