import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { Hono } from "hono";
import { plannerSettings } from "../db/settingsSchema";
import { runPlannerAutomations } from "../plannerAutomation";
import { plannerPreferencesPatchSchema, plannerSettingsInputSchema } from "../settingsValidation";
import { getReminderPlannerDate } from "../reminders/incompleteTodoReminder";
import type { Bindings, Variables } from "../types";
import { newId, nowIso } from "../utils";

export const settingsRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>();

export const DEFAULT_PLANNER_SETTINGS = {
  carryOverEnabled: false,
  autoArchiveCompleted: false,
  reminderTodayEnabled: true,
  reminderOverdueEnabled: false,
  reminderDueSoonEnabled: false,
  reminderDueSoonDays: 3,
  dailyGoalMinutes: 0,
  wipLimits: {} as Record<string, Record<string, number>>,
};

const parseWipLimits = (value: string | null | undefined): Record<string, Record<string, number>> => {
  try {
    const parsed: unknown = JSON.parse(value || "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, Record<string, number>> : {};
  } catch { return {}; }
};

const serializeSettings = (row: typeof plannerSettings.$inferSelect) => ({ ...row, wipLimitsJson: undefined, wipLimits: parseWipLimits(row.wipLimitsJson) });

const getSettings = async (db: ReturnType<typeof drizzle>, userId: string) => {
  const [row] = await db.select().from(plannerSettings).where(eq(plannerSettings.userId, userId)).limit(1);
  return row ? serializeSettings(row) : DEFAULT_PLANNER_SETTINGS;
};

settingsRoutes.get("/planner-settings", async (c) => {
  const db = drizzle(c.env.DB);
  return c.json({ plannerSettings: await getSettings(db, c.get("userId")) });
});

settingsRoutes.put("/planner-settings", async (c) => {
  const input = plannerSettingsInputSchema.parse(await c.req.json());
  const db = drizzle(c.env.DB);
  const userId = c.get("userId");
  const [existing] = await db.select().from(plannerSettings).where(eq(plannerSettings.userId, userId)).limit(1);
  const now = nowIso();
  if (existing) await db.update(plannerSettings).set({ ...input, updatedAt: now }).where(eq(plannerSettings.id, existing.id));
  else await db.insert(plannerSettings).values({ id: newId(), userId, ...input, createdAt: now, updatedAt: now });
  return c.json({ plannerSettings: await getSettings(db, userId) });
});

settingsRoutes.patch("/planner-settings", async (c) => {
  const input = plannerPreferencesPatchSchema.parse(await c.req.json());
  const db = drizzle(c.env.DB);
  const userId = c.get("userId");
  const [existing] = await db.select().from(plannerSettings).where(eq(plannerSettings.userId, userId)).limit(1);
  const now = nowIso();
  const changes = {
    ...(input.dailyGoalMinutes !== undefined ? { dailyGoalMinutes: input.dailyGoalMinutes } : {}),
    ...(input.wipLimits !== undefined ? { wipLimitsJson: JSON.stringify(input.wipLimits) } : {}),
  };
  if (existing) await db.update(plannerSettings).set({ ...changes, updatedAt: now }).where(eq(plannerSettings.id, existing.id));
  else await db.insert(plannerSettings).values({ id: newId(), userId, ...changes, createdAt: now, updatedAt: now });
  return c.json({ plannerSettings: await getSettings(db, userId) });
});

settingsRoutes.post("/planner-automations/run", async (c) => {
  const db = drizzle(c.env.DB);
  const userId = c.get("userId");
  const settings = await getSettings(db, userId);
  const plannerDate = getReminderPlannerDate(new Date());
  return c.json({ automation: await runPlannerAutomations(c.env, userId, plannerDate, settings) });
});
