import { useCallback, useState } from "react";
import { api, apiAllPages, jsonBody } from "../lib/api/client";
import { getWeekRange, todayKey } from "../lib/date";
import type {
  DailyPlan,
  DailyPlanInput,
  SavedView,
  SavedViewInput,
  TaskTemplate,
  TaskTemplateInput,
  WeeklyReview,
  WeeklyReviewInput,
} from "../types/planning";

const getMessage = (error: unknown) => error instanceof Error ? error.message : "계획 데이터를 처리하지 못했습니다.";

export function usePlanning() {
  const [dailyPlan, setDailyPlan] = useState<DailyPlan | undefined>();
  const [weeklyReview, setWeeklyReview] = useState<WeeklyReview | undefined>();
  const [savedViews, setSavedViews] = useState<SavedView[]>([]);
  const [taskTemplates, setTaskTemplates] = useState<TaskTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const loadPlanning = useCallback(async () => {
    setLoading(true);
    try {
      const today = todayKey();
      const weekStart = getWeekRange().start;
      const [dailyRows, reviewRows, viewRows, templateRows] = await Promise.all([
        apiAllPages<DailyPlan>(`/api/daily-plans?date=${today}`, "dailyPlans"),
        apiAllPages<WeeklyReview>(`/api/weekly-reviews?weekStartDate=${weekStart}`, "weeklyReviews"),
        apiAllPages<SavedView>("/api/saved-views", "savedViews"),
        apiAllPages<TaskTemplate>("/api/task-templates", "taskTemplates"),
      ]);
      setDailyPlan(dailyRows[0]);
      setWeeklyReview(reviewRows[0]);
      setSavedViews(viewRows);
      setTaskTemplates(templateRows);
      setError("");
    } catch (err) {
      setError(getMessage(err));
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const saveDailyPlan = useCallback(async (date: string, input: DailyPlanInput) => {
    setSaving(true);
    try {
      const result = await api<{ dailyPlan: DailyPlan }>(`/api/daily-plans/${date}`, { method: "PUT", ...jsonBody(input) });
      setDailyPlan(result.dailyPlan);
      setError("");
      return result.dailyPlan;
    } catch (err) {
      setError(getMessage(err));
      return undefined;
    } finally {
      setSaving(false);
    }
  }, []);

  const saveWeeklyReview = useCallback(async (weekStartDate: string, input: WeeklyReviewInput) => {
    setSaving(true);
    try {
      const result = await api<{ weeklyReview: WeeklyReview }>(`/api/weekly-reviews/${weekStartDate}`, { method: "PUT", ...jsonBody(input) });
      setWeeklyReview(result.weeklyReview);
      setError("");
      return result.weeklyReview;
    } catch (err) {
      setError(getMessage(err));
      return undefined;
    } finally {
      setSaving(false);
    }
  }, []);

  const addSavedView = useCallback(async (input: SavedViewInput) => {
    setSaving(true);
    try {
      const result = await api<{ savedView: SavedView }>("/api/saved-views", { method: "POST", ...jsonBody(input) });
      setSavedViews((current) => [...current, result.savedView].sort((a, b) => a.name.localeCompare(b.name, "ko")));
      setError("");
      return result.savedView;
    } catch (err) {
      setError(getMessage(err));
      return undefined;
    } finally {
      setSaving(false);
    }
  }, []);

  const deleteSavedView = useCallback(async (id: string) => {
    const previous = savedViews;
    setSavedViews((current) => current.filter((item) => item.id !== id));
    try {
      await api(`/api/saved-views/${id}`, { method: "DELETE" });
      setError("");
      return true;
    } catch (err) {
      setSavedViews(previous);
      setError(getMessage(err));
      return false;
    }
  }, [savedViews]);

  const addTaskTemplate = useCallback(async (input: TaskTemplateInput) => {
    setSaving(true);
    try {
      const result = await api<{ taskTemplate: TaskTemplate }>("/api/task-templates", { method: "POST", ...jsonBody(input) });
      setTaskTemplates((current) => [...current, result.taskTemplate].sort((a, b) => a.name.localeCompare(b.name, "ko")));
      setError("");
      return result.taskTemplate;
    } catch (err) {
      setError(getMessage(err));
      return undefined;
    } finally {
      setSaving(false);
    }
  }, []);

  const deleteTaskTemplate = useCallback(async (id: string) => {
    const previous = taskTemplates;
    setTaskTemplates((current) => current.filter((item) => item.id !== id));
    try {
      await api(`/api/task-templates/${id}`, { method: "DELETE" });
      setError("");
      return true;
    } catch (err) {
      setTaskTemplates(previous);
      setError(getMessage(err));
      return false;
    }
  }, [taskTemplates]);

  return {
    dailyPlan,
    weeklyReview,
    savedViews,
    taskTemplates,
    loading,
    saving,
    error,
    loadPlanning,
    saveDailyPlan,
    saveWeeklyReview,
    addSavedView,
    deleteSavedView,
    addTaskTemplate,
    deleteTaskTemplate,
  };
}
