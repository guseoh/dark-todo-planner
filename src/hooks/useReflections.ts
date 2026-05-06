import { useCallback, useEffect, useMemo, useState } from "react";
import { createId } from "../lib/id";
import { readJson, validateReflections, writeJson } from "../lib/storage";
import { STORAGE_KEYS } from "../lib/storageKeys";
import type { Reflection, ReflectionType } from "../types/reflection";

export function useReflections() {
  const [reflections, setReflections] = useState<Reflection[]>(() => {
    const stored = validateReflections(readJson<unknown>(STORAGE_KEYS.REFLECTIONS, []));
    return stored || [];
  });

  useEffect(() => {
    writeJson(STORAGE_KEYS.REFLECTIONS, reflections);
  }, [reflections]);

  const addReflection = useCallback((input: { date: string; type: ReflectionType; content: string }) => {
    const content = input.content.trim();
    if (!content) return;
    const now = new Date().toISOString();
    setReflections((current) => [
      {
        id: createId(),
        date: input.date,
        type: input.type,
        content,
        sections: [{ id: "legacy-content", title: "메모", content, order: 0 }],
        createdAt: now,
        updatedAt: now,
      },
      ...current,
    ]);
  }, []);

  const updateReflection = useCallback((id: string, updates: Partial<Pick<Reflection, "date" | "type" | "content">>) => {
    setReflections((current) =>
      current.map((reflection) =>
        reflection.id === id
          ? {
              ...reflection,
              ...updates,
              content: updates.content?.trim() || reflection.content,
              updatedAt: new Date().toISOString(),
            }
          : reflection,
      ),
    );
  }, []);

  const deleteReflection = useCallback((id: string) => {
    setReflections((current) => current.filter((reflection) => reflection.id !== id));
  }, []);

  const replaceReflections = useCallback((next: Reflection[]) => setReflections(next), []);
  const clearReflections = useCallback(() => setReflections([]), []);

  const recentReflection = useMemo(
    () => [...reflections].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0],
    [reflections],
  );

  return {
    reflections,
    recentReflection,
    addReflection,
    updateReflection,
    deleteReflection,
    replaceReflections,
    clearReflections,
  };
}
