import { useCallback, useState } from "react";
import { api, jsonBody } from "../lib/api/client";
import type { PlannerAutomationResult, PlannerSettings, PlannerSettingsInput } from "../types/settings";

const defaults: PlannerSettings = {
  carryOverEnabled: false,
  autoArchiveCompleted: false,
  reminderTodayEnabled: true,
  reminderOverdueEnabled: false,
  reminderDueSoonEnabled: false,
  reminderDueSoonDays: 3,
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

  return { settings, saving, error, loadSettings, saveSettings, runAutomations };
}
