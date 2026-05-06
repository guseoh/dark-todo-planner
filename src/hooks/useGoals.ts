import { useCallback, useEffect, useMemo, useState } from "react";
import { createId } from "../lib/id";
import { readJson, validateGoals, writeJson } from "../lib/storage";
import { STORAGE_KEYS } from "../lib/storageKeys";
import type { Goal } from "../types/goal";

const clampProgress = (value: number) => Math.min(100, Math.max(0, Math.round(value || 0)));

export function useGoals() {
  const [goals, setGoals] = useState<Goal[]>(() => {
    const stored = validateGoals(readJson<unknown>(STORAGE_KEYS.GOALS, []));
    return stored || [];
  });

  useEffect(() => {
    writeJson(STORAGE_KEYS.GOALS, goals);
  }, [goals]);

  const addGoal = useCallback((input: { title: string; description?: string; dueDate: string; progress: number }) => {
    const title = input.title.trim();
    if (!title) return;
    const now = new Date().toISOString();
    setGoals((current) => [
      {
        id: createId(),
        title,
        description: input.description?.trim() || undefined,
        dueDate: input.dueDate,
        progress: clampProgress(input.progress),
        completed: false,
        createdAt: now,
        updatedAt: now,
      },
      ...current,
    ]);
  }, []);

  const updateGoal = useCallback((id: string, updates: Partial<Omit<Goal, "id" | "createdAt">>) => {
    setGoals((current) =>
      current.map((goal) =>
        goal.id === id
          ? {
              ...goal,
              ...updates,
              title: updates.title?.trim() || goal.title,
              description: updates.description?.trim() || undefined,
              progress: updates.progress === undefined ? goal.progress : clampProgress(updates.progress),
              updatedAt: new Date().toISOString(),
            }
          : goal,
      ),
    );
  }, []);

  const toggleGoal = useCallback((id: string) => {
    setGoals((current) =>
      current.map((goal) =>
        goal.id === id
          ? {
              ...goal,
              completed: !goal.completed,
              progress: goal.completed ? goal.progress : 100,
              updatedAt: new Date().toISOString(),
            }
          : goal,
      ),
    );
  }, []);

  const deleteGoal = useCallback((id: string) => {
    setGoals((current) => current.filter((goal) => goal.id !== id));
  }, []);

  const replaceGoals = useCallback((next: Goal[]) => setGoals(next), []);
  const clearGoals = useCallback(() => setGoals([]), []);

  const nearestGoal = useMemo(
    () =>
      [...goals]
        .filter((goal) => !goal.completed)
        .sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0],
    [goals],
  );

  return {
    goals,
    nearestGoal,
    addGoal,
    updateGoal,
    toggleGoal,
    deleteGoal,
    replaceGoals,
    clearGoals,
  };
}
