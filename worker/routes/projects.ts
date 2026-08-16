import { and, asc, desc, eq, max } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { Hono } from "hono";
import { z } from "zod";
import { milestones, projectDecisions, projects } from "../db/schema";
import type { Bindings, Variables } from "../types";
import { newId, normalizeIcon, nowIso, optional, pagination } from "../utils";
import { milestoneInputSchema, projectDecisionInputSchema, projectInputSchema } from "../validation";

export const projectRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>();

const serialize = <T extends Record<string, unknown>>(row: T) =>
  Object.fromEntries(Object.entries(row).map(([key, value]) => [key, value === null ? undefined : value]));

const httpUrlSchema = z.string().trim().max(2048).url().refine((value) => {
  try {
    const protocol = new URL(value).protocol;
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}, "http 또는 https 링크만 사용할 수 있습니다.");

const projectResourcesSchema = z.array(z.object({
  id: z.string().trim().min(1).max(80),
  label: z.string().trim().min(1).max(80),
  url: httpUrlSchema,
})).max(12);

type ProjectResource = z.infer<typeof projectResourcesSchema>[number];
type ProjectResourceRow = { id: string; resources_json: string | null };

const parseResources = (value?: string | null): ProjectResource[] => {
  if (!value) return [];
  try {
    const parsed = projectResourcesSchema.safeParse(JSON.parse(value));
    return parsed.success ? parsed.data : [];
  } catch {
    return [];
  }
};

const resourcesFromPayload = (payload: unknown) => {
  const value = payload && typeof payload === "object" ? (payload as Record<string, unknown>).resources : undefined;
  return projectResourcesSchema.parse(value ?? []);
};

const loadProjectResourceMap = async (database: D1Database, userId: string) => {
  const result = await database.prepare("SELECT id, resources_json FROM projects WHERE user_id = ?").bind(userId).all<ProjectResourceRow>();
  return new Map(result.results.map((row) => [row.id, parseResources(row.resources_json)]));
};

const loadProjectResources = async (database: D1Database, userId: string, id: string) => {
  const row = await database.prepare("SELECT resources_json FROM projects WHERE id = ? AND user_id = ?").bind(id, userId).first<{ resources_json: string | null }>();
  return parseResources(row?.resources_json);
};

const serializeProject = <T extends Record<string, unknown>>(row: T, resources: ProjectResource[]) => ({ ...serialize(row), resources });

projectRoutes.get("/projects", async (c) => {
  const db = drizzle(c.env.DB); const page = pagination((name) => c.req.query(name)); const archived = c.req.query("archived"); const userId = c.get("userId");
  const filters = [eq(projects.userId, userId)];
  if (archived === "true" || archived === "false") filters.push(eq(projects.archived, archived === "true")); else if (archived !== "all") filters.push(eq(projects.archived, false));
  const [rows, resourceMap] = await Promise.all([
    db.select().from(projects).where(and(...filters)).orderBy(asc(projects.order), asc(projects.createdAt)).limit(page.limit).offset(page.offset),
    loadProjectResourceMap(c.env.DB, userId),
  ]);
  return c.json({ projects: rows.map((row) => serializeProject(row, resourceMap.get(row.id) || [])), nextCursor: page.next(rows.length) });
});

projectRoutes.post("/projects", async (c) => {
  const payload = await c.req.json(); const input = projectInputSchema.parse(payload); const resources = resourcesFromPayload(payload); const db = drizzle(c.env.DB); const userId = c.get("userId");
  const [maximum] = await db.select({ value: max(projects.order) }).from(projects).where(eq(projects.userId, userId)); const now = nowIso();
  const row = {
    id: newId(), userId, name: input.name, description: optional(input.description), status: input.status,
    color: input.color || "#6366f1", icon: normalizeIcon(input.icon), startDate: optional(input.startDate), targetDate: optional(input.targetDate),
    archived: input.archived || false, archivedAt: input.archived ? now : null, order: input.order ?? (maximum.value ?? -1) + 1, createdAt: now, updatedAt: now,
  };
  await db.insert(projects).values(row);
  await c.env.DB.prepare("UPDATE projects SET resources_json = ? WHERE id = ? AND user_id = ?").bind(JSON.stringify(resources), row.id, userId).run();
  return c.json({ project: serializeProject(row, resources) }, 201);
});

projectRoutes.put("/projects/:id", async (c) => {
  const payload = await c.req.json(); const input = projectInputSchema.parse(payload); const resources = resourcesFromPayload(payload); const db = drizzle(c.env.DB); const id = c.req.param("id"), userId = c.get("userId");
  const [existing] = await db.select().from(projects).where(and(eq(projects.id, id), eq(projects.userId, userId))).limit(1); if (!existing) return c.json({ message: "프로젝트를 찾을 수 없습니다." }, 404);
  const archived = input.archived ?? existing.archived;
  await db.update(projects).set({
    name: input.name, description: optional(input.description), status: input.status, color: input.color || existing.color, icon: normalizeIcon(input.icon),
    startDate: optional(input.startDate), targetDate: optional(input.targetDate), archived,
    archivedAt: archived && !existing.archived ? nowIso() : !archived ? null : existing.archivedAt, order: input.order ?? existing.order, updatedAt: nowIso(),
  }).where(eq(projects.id, id));
  await c.env.DB.prepare("UPDATE projects SET resources_json = ? WHERE id = ? AND user_id = ?").bind(JSON.stringify(resources), id, userId).run();
  const [row] = await db.select().from(projects).where(eq(projects.id, id)); return c.json({ project: serializeProject(row, resources) });
});

for (const action of ["archive", "unarchive"] as const) {
  projectRoutes.patch(`/projects/:id/${action}`, async (c) => {
    const db = drizzle(c.env.DB); const id = c.req.param("id"), userId = c.get("userId");
    const [existing] = await db.select().from(projects).where(and(eq(projects.id, id), eq(projects.userId, userId))).limit(1); if (!existing) return c.json({ message: "프로젝트를 찾을 수 없습니다." }, 404);
    const archived = action === "archive"; await db.update(projects).set({ archived, archivedAt: archived ? nowIso() : null, updatedAt: nowIso() }).where(eq(projects.id, id));
    const [row, resources] = await Promise.all([db.select().from(projects).where(eq(projects.id, id)).then((rows) => rows[0]), loadProjectResources(c.env.DB, userId, id)]);
    return c.json({ project: serializeProject(row, resources) });
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
