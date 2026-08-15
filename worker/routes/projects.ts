import { and, asc, desc, eq, max } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { Hono } from "hono";
import { milestones, projectDecisions, projects } from "../db/schema";
import type { Bindings, Variables } from "../types";
import { newId, normalizeIcon, nowIso, optional, pagination } from "../utils";
import { milestoneInputSchema, projectDecisionInputSchema, projectInputSchema } from "../validation";

export const projectRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>();

const serialize = <T extends Record<string, unknown>>(row: T) =>
  Object.fromEntries(Object.entries(row).map(([key, value]) => [key, value === null ? undefined : value]));

projectRoutes.get("/projects", async (c) => {
  const db = drizzle(c.env.DB); const page = pagination((name) => c.req.query(name)); const archived = c.req.query("archived");
  const filters = [eq(projects.userId, c.get("userId"))];
  if (archived === "true" || archived === "false") filters.push(eq(projects.archived, archived === "true")); else if (archived !== "all") filters.push(eq(projects.archived, false));
  const rows = await db.select().from(projects).where(and(...filters)).orderBy(asc(projects.order), asc(projects.createdAt)).limit(page.limit).offset(page.offset);
  return c.json({ projects: rows.map(serialize), nextCursor: page.next(rows.length) });
});

projectRoutes.post("/projects", async (c) => {
  const input = projectInputSchema.parse(await c.req.json()); const db = drizzle(c.env.DB); const userId = c.get("userId");
  const [maximum] = await db.select({ value: max(projects.order) }).from(projects).where(eq(projects.userId, userId)); const now = nowIso();
  const row = {
    id: newId(), userId, name: input.name, description: optional(input.description), status: input.status,
    color: input.color || "#6366f1", icon: normalizeIcon(input.icon), startDate: optional(input.startDate), targetDate: optional(input.targetDate),
    archived: input.archived || false, archivedAt: input.archived ? now : null, order: input.order ?? (maximum.value ?? -1) + 1, createdAt: now, updatedAt: now,
  };
  await db.insert(projects).values(row); return c.json({ project: serialize(row) }, 201);
});

projectRoutes.put("/projects/:id", async (c) => {
  const input = projectInputSchema.parse(await c.req.json()); const db = drizzle(c.env.DB); const id = c.req.param("id"), userId = c.get("userId");
  const [existing] = await db.select().from(projects).where(and(eq(projects.id, id), eq(projects.userId, userId))).limit(1); if (!existing) return c.json({ message: "프로젝트를 찾을 수 없습니다." }, 404);
  const archived = input.archived ?? existing.archived;
  await db.update(projects).set({
    name: input.name, description: optional(input.description), status: input.status, color: input.color || existing.color, icon: normalizeIcon(input.icon),
    startDate: optional(input.startDate), targetDate: optional(input.targetDate), archived,
    archivedAt: archived && !existing.archived ? nowIso() : !archived ? null : existing.archivedAt, order: input.order ?? existing.order, updatedAt: nowIso(),
  }).where(eq(projects.id, id));
  const [row] = await db.select().from(projects).where(eq(projects.id, id)); return c.json({ project: serialize(row) });
});

for (const action of ["archive", "unarchive"] as const) {
  projectRoutes.patch(`/projects/:id/${action}`, async (c) => {
    const db = drizzle(c.env.DB); const id = c.req.param("id"), userId = c.get("userId");
    const [existing] = await db.select().from(projects).where(and(eq(projects.id, id), eq(projects.userId, userId))).limit(1); if (!existing) return c.json({ message: "프로젝트를 찾을 수 없습니다." }, 404);
    const archived = action === "archive"; await db.update(projects).set({ archived, archivedAt: archived ? nowIso() : null, updatedAt: nowIso() }).where(eq(projects.id, id));
    const [row] = await db.select().from(projects).where(eq(projects.id, id)); return c.json({ project: serialize(row) });
  });
}

projectRoutes.get("/milestones", async (c) => {
  const db = drizzle(c.env.DB); const page = pagination((name) => c.req.query(name)); const projectId = c.req.query("projectId"); const filters = [eq(milestones.userId, c.get("userId"))];
  if (projectId) filters.push(eq(milestones.projectId, projectId));
  const rows = await db.select().from(milestones).where(and(...filters)).orderBy(asc(milestones.order), asc(milestones.targetDate), asc(milestones.createdAt)).limit(page.limit).offset(page.offset);
  return c.json({ milestones: rows.map(serialize), nextCursor: page.next(rows.length) });
});

projectRoutes.post("/milestones", async (c) => {
  const input = milestoneInputSchema.parse(await c.req.json()); const db = drizzle(c.env.DB); const userId = c.get("userId");
  const [project] = await db.select({ id: projects.id }).from(projects).where(and(eq(projects.id, input.projectId), eq(projects.userId, userId))).limit(1); if (!project) return c.json({ message: "프로젝트를 찾을 수 없습니다." }, 400);
  const [maximum] = await db.select({ value: max(milestones.order) }).from(milestones).where(eq(milestones.projectId, input.projectId)); const now = nowIso();
  const row = { id: newId(), userId, projectId: input.projectId, title: input.title, description: optional(input.description), targetDate: optional(input.targetDate), status: input.status, order: input.order ?? (maximum.value ?? -1) + 1, createdAt: now, updatedAt: now };
  await db.insert(milestones).values(row); return c.json({ milestone: serialize(row) }, 201);
});

projectRoutes.put("/milestones/:id", async (c) => {
  const input = milestoneInputSchema.parse(await c.req.json()); const db = drizzle(c.env.DB); const id = c.req.param("id"), userId = c.get("userId");
  const [existing] = await db.select().from(milestones).where(and(eq(milestones.id, id), eq(milestones.userId, userId))).limit(1); if (!existing) return c.json({ message: "마일스톤을 찾을 수 없습니다." }, 404);
  const [project] = await db.select({ id: projects.id }).from(projects).where(and(eq(projects.id, input.projectId), eq(projects.userId, userId))).limit(1); if (!project) return c.json({ message: "프로젝트를 찾을 수 없습니다." }, 400);
  await db.update(milestones).set({ projectId: input.projectId, title: input.title, description: optional(input.description), targetDate: optional(input.targetDate), status: input.status, order: input.order ?? existing.order, updatedAt: nowIso() }).where(eq(milestones.id, id));
  const [row] = await db.select().from(milestones).where(eq(milestones.id, id)); return c.json({ milestone: serialize(row) });
});

projectRoutes.delete("/milestones/:id", async (c) => {
  const db = drizzle(c.env.DB); await db.delete(milestones).where(and(eq(milestones.id, c.req.param("id")), eq(milestones.userId, c.get("userId")))); return c.json({ ok: true });
});

projectRoutes.get("/project-decisions", async (c) => {
  const db = drizzle(c.env.DB); const page = pagination((name) => c.req.query(name)); const projectId = c.req.query("projectId"); const filters = [eq(projectDecisions.userId, c.get("userId"))];
  if (projectId) filters.push(eq(projectDecisions.projectId, projectId));
  const rows = await db.select().from(projectDecisions).where(and(...filters)).orderBy(desc(projectDecisions.decidedAt), desc(projectDecisions.createdAt)).limit(page.limit).offset(page.offset);
  return c.json({ decisions: rows.map(serialize), nextCursor: page.next(rows.length) });
});

projectRoutes.post("/project-decisions", async (c) => {
  const input = projectDecisionInputSchema.parse(await c.req.json()); const db = drizzle(c.env.DB); const userId = c.get("userId");
  const [project] = await db.select({ id: projects.id }).from(projects).where(and(eq(projects.id, input.projectId), eq(projects.userId, userId))).limit(1); if (!project) return c.json({ message: "프로젝트를 찾을 수 없습니다." }, 400);
  const now = nowIso(); const row = { id: newId(), userId, projectId: input.projectId, title: input.title, decision: input.decision, rationale: optional(input.rationale), decidedAt: input.decidedAt || now.slice(0, 10), createdAt: now, updatedAt: now };
  await db.insert(projectDecisions).values(row); return c.json({ decision: serialize(row) }, 201);
});

projectRoutes.put("/project-decisions/:id", async (c) => {
  const input = projectDecisionInputSchema.parse(await c.req.json()); const db = drizzle(c.env.DB); const id = c.req.param("id"), userId = c.get("userId");
  const [existing] = await db.select().from(projectDecisions).where(and(eq(projectDecisions.id, id), eq(projectDecisions.userId, userId))).limit(1); if (!existing) return c.json({ message: "의사결정 기록을 찾을 수 없습니다." }, 404);
  const [project] = await db.select({ id: projects.id }).from(projects).where(and(eq(projects.id, input.projectId), eq(projects.userId, userId))).limit(1); if (!project) return c.json({ message: "프로젝트를 찾을 수 없습니다." }, 400);
  await db.update(projectDecisions).set({ projectId: input.projectId, title: input.title, decision: input.decision, rationale: optional(input.rationale), decidedAt: input.decidedAt || existing.decidedAt, updatedAt: nowIso() }).where(eq(projectDecisions.id, id));
  const [row] = await db.select().from(projectDecisions).where(eq(projectDecisions.id, id)); return c.json({ decision: serialize(row) });
});

projectRoutes.delete("/project-decisions/:id", async (c) => {
  const db = drizzle(c.env.DB); await db.delete(projectDecisions).where(and(eq(projectDecisions.id, c.req.param("id")), eq(projectDecisions.userId, c.get("userId")))); return c.json({ ok: true });
});
