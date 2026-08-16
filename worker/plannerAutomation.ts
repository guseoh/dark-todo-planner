import type { Bindings } from "./types";

export type AutomationSettings = {
  carryOverEnabled: boolean;
  autoArchiveCompleted: boolean;
};

export type PlannerAutomationResult = {
  plannerDate: string;
  carriedOver: number;
  autoArchived: number;
};

export async function runPlannerAutomations(
  env: Pick<Bindings, "DB">,
  userId: string,
  plannerDate: string,
  settings: AutomationSettings,
): Promise<PlannerAutomationResult> {
  let carriedOver = 0;
  let autoArchived = 0;
  const now = new Date().toISOString();

  if (settings.carryOverEnabled) {
    const result = await env.DB.prepare(
      "UPDATE todos SET date = ?, planning_state = 'SCHEDULED', updated_at = ? WHERE user_id = ? AND archived = 0 AND completed = 0 AND repeat = 'NONE' AND planning_state = 'SCHEDULED' AND date < ?",
    ).bind(plannerDate, now, userId, plannerDate).run();
    carriedOver = result.meta.changes || 0;
  }

  if (settings.autoArchiveCompleted) {
    const result = await env.DB.prepare(
      "UPDATE todos SET archived = 1, archived_at = COALESCE(archived_at, ?), updated_at = ? WHERE user_id = ? AND completed = 1 AND archived = 0",
    ).bind(now, now, userId).run();
    autoArchived = result.meta.changes || 0;
  }

  return { plannerDate, carriedOver, autoArchived };
}
