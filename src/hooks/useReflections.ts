import { useCallback, useMemo, useState } from "react";
import type { Reflection } from "../types/reflection";
import { api, jsonBody } from "../lib/api/client";

const getMessage = (error: unknown) => (error instanceof Error ? error.message : "회고 요청 처리 중 오류가 발생했습니다.");

type ReflectionInput = {
  date: string;
  type: Reflection["type"];
  sections: Reflection["sections"];
  content?: string;
};

export function useReflections() {
  const [reflections, setReflections] = useState<Reflection[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const loadReflections = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api<{ reflections: Reflection[] }>("/api/reflections");
      setReflections(result.reflections);
      setError("");
      return result.reflections;
    } catch (err) {
      setError(getMessage(err));
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const addReflection = useCallback(async (input: ReflectionInput) => {
    setSaving(true);
    try {
      const result = await api<{ reflection: Reflection }>("/api/reflections", { method: "POST", ...jsonBody(input) });
      setReflections((current) => [result.reflection, ...current]);
      setError("");
      return result.reflection;
    } catch (err) {
      setError(getMessage(err));
      return undefined;
    } finally {
      setSaving(false);
    }
  }, []);

  const updateReflection = useCallback(async (id: string, input: Partial<Pick<Reflection, "date" | "type" | "content" | "sections">>) => {
    const existing = reflections.find((reflection) => reflection.id === id);
    if (!existing) return undefined;
    setSaving(true);
    try {
      const result = await api<{ reflection: Reflection }>(`/api/reflections/${id}`, {
        method: "PUT",
        ...jsonBody({ ...existing, ...input }),
      });
      setReflections((current) => current.map((reflection) => (reflection.id === id ? result.reflection : reflection)));
      setError("");
      return result.reflection;
    } catch (err) {
      setError(getMessage(err));
      return undefined;
    } finally {
      setSaving(false);
    }
  }, [reflections]);

  const deleteReflection = useCallback(async (id: string) => {
    try {
      await api(`/api/reflections/${id}`, { method: "DELETE" });
      setReflections((current) => current.filter((reflection) => reflection.id !== id));
      setError("");
    } catch (err) {
      setError(getMessage(err));
    }
  }, []);

  const recentReflection = useMemo(() => [...reflections].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0], [reflections]);

  return {
    reflections,
    recentReflection,
    loading,
    saving,
    error,
    loadReflections,
    addReflection,
    updateReflection,
    deleteReflection,
  };
}
