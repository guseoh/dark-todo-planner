import { useCallback, useMemo, useState } from "react";
import type { Goal } from "../types/goal";
import { api, jsonBody } from "../lib/api/client";

const getMessage = (error: unknown) => (error instanceof Error ? error.message : "목표 요청 처리 중 오류가 발생했습니다.");
const clampProgress = (value?: number) => Math.min(100, Math.max(0, Math.round(value || 0)));

const normalizeGoalInput = (input: Partial<Goal> & { title: string }) => ({
  ...input,
  progress: clampProgress(input.progress),
});

export function useGoals() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const loadGoals = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api<{ goals: Goal[] }>("/api/goals");
      setGoals(result.goals);
      setError("");
      return result.goals;
    } catch (err) {
      setError(getMessage(err));
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const addGoal = useCallback(async (input: Partial<Goal> & { title: string }) => {
    setSaving(true);
    try {
      const result = await api<{ goal: Goal }>("/api/goals", { method: "POST", ...jsonBody(normalizeGoalInput(input)) });
      setGoals((current) => [result.goal, ...current]);
      setError("");
      return result.goal;
    } catch (err) {
      setError(getMessage(err));
      return undefined;
    } finally {
      setSaving(false);
    }
  }, []);

  const updateGoal = useCallback(async (id: string, input: Partial<Goal>) => {
    const existing = goals.find((goal) => goal.id === id);
    if (!existing) return undefined;
    setSaving(true);
    try {
      const result = await api<{ goal: Goal }>(`/api/goals/${id}`, {
        method: "PUT",
        ...jsonBody(normalizeGoalInput({ ...existing, ...input })),
      });
      setGoals((current) => current.map((goal) => (goal.id === id ? result.goal : goal)));
      setError("");
      return result.goal;
    } catch (err) {
      setError(getMessage(err));
      return undefined;
    } finally {
      setSaving(false);
    }
  }, [goals]);

  const toggleGoal = useCallback(async (id: string) => {
    try {
      const result = await api<{ goal: Goal }>(`/api/goals/${id}/toggle`, { method: "PATCH" });
      setGoals((current) => current.map((goal) => (goal.id === id ? result.goal : goal)));
      setError("");
    } catch (err) {
      setError(getMessage(err));
    }
  }, []);

  const deleteGoal = useCallback(async (id: string) => {
    try {
      await api(`/api/goals/${id}`, { method: "DELETE" });
      setGoals((current) => current.filter((goal) => goal.id !== id));
      setError("");
    } catch (err) {
      setError(getMessage(err));
    }
  }, []);

  const nearestGoal = useMemo(
    () => [...goals].filter((goal) => !goal.completed).sort((a, b) => (a.dueDate || a.targetDate || "").localeCompare(b.dueDate || b.targetDate || ""))[0],
    [goals],
  );

  return {
    goals,
    nearestGoal,
    loading,
    saving,
    error,
    loadGoals,
    addGoal,
    updateGoal,
    toggleGoal,
    deleteGoal,
  };
}
