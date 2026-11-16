import { useCallback, useRef, useState } from "react";
import { api, jsonBody } from "../lib/api/client";
import type { PlannerAutomationResult, PlannerPreferencesPatch, PlannerSettings, PlannerSettingsInput } from "../types/settings";

const defaults: PlannerSettings = {
  carryOverEnabled: false,
  autoArchiveCompleted: false,
  reminderTodayEnabled: true,
  reminderOverdueEnabled: false,
  reminderDueSoonEnabled: false,
  reminderDueSoonDays: 3,
  dailyGoalMinutes: 0,
  wipLimits: {},
};

const getMessage = (error: unknown) => error instanceof Error ? error.message : "설정을 처리하지 못했습니다.";

export function usePlannerSettings() {
  const [settings, setSettings] = useState<PlannerSettings>(defaults);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const loadSettings = useCallback(async () => {
    try {
      const result = await api<{ plannerSettings: PlannerSettings }>("/api/planner-settings");
      setSettings({ ...defaults, ...result.plannerSettings });
      setError("");
      return result.plannerSettings;
    } catch (err) {
      setError(getMessage(err));
      throw err;
    }
  }, []);

  const saveSettings = useCallback(async (input: PlannerSettingsInput) => {
    setSaving(true);
    try {
      const result = await api<{ plannerSettings: PlannerSettings }>("/api/planner-settings", { method: "PUT", ...jsonBody(input) });
      setSettings(result.plannerSettings);
      setError("");
      return result.plannerSettings;
    } catch (err) {
      setError(getMessage(err));
      return undefined;
    } finally {
      setSaving(false);
    }
  }, []);

  /**
   * Saves time goal / WIP limits without touching the reminder settings form. The screen updates
   * immediately; WIP limits (edited key by key) are sent once typing pauses.
   */
  const pendingWip = useRef<PlannerPreferencesPatch["wipLimits"]>(undefined);
  const wipTimer = useRef<number | null>(null);
  const send = useCallback(async (patch: PlannerPreferencesPatch) => {
    try {
      const result = await api<{ plannerSettings: PlannerSettings }>("/api/planner-settings", { method: "PATCH", ...jsonBody(patch) });
      setSettings((current) => ({
        ...current,
        ...(patch.dailyGoalMinutes !== undefined ? { dailyGoalMinutes: result.plannerSettings.dailyGoalMinutes } : {}),
        ...(patch.wipLimits !== undefined && wipTimer.current === null ? { wipLimits: result.plannerSettings.wipLimits } : {}),
      }));
      setError("");
      return true;
    } catch (err) {
      setError(getMessage(err));
      // Resync with the server so the screen never keeps a value that was not saved.
      void api<{ plannerSettings: PlannerSettings }>("/api/planner-settings")
        .then((result) => setSettings({ ...defaults, ...result.plannerSettings })).catch(() => undefined);
      return false;
    }
  }, []);

  const patchPreferences = useCallback(async (patch: PlannerPreferencesPatch) => {
    setSettings((current) => ({ ...current, ...patch }));
    if (patch.wipLimits !== undefined && patch.dailyGoalMinutes === undefined) {
      pendingWip.current = patch.wipLimits;
      if (wipTimer.current !== null) window.clearTimeout(wipTimer.current);
      wipTimer.current = window.setTimeout(() => {
        wipTimer.current = null;
        const wipLimits = pendingWip.current;
        pendingWip.current = undefined;
        if (wipLimits) void send({ wipLimits });
      }, 500);
      return true;
    }
    return send(patch);
  }, [send]);

  const runAutomations = useCallback(async () => {
    try {
      const result = await api<{ automation: PlannerAutomationResult }>("/api/planner-automations/run", { method: "POST" });
      setError("");
      return result.automation;
    } catch (err) {
      setError(getMessage(err));
      return undefined;
    }
  }, []);

  return { settings, saving, error, loadSettings, saveSettings, patchPreferences, runAutomations };
}
