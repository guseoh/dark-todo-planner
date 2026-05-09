import { useCallback, useState } from "react";
import type { Category } from "../types/category";
import { api, jsonBody } from "../lib/api/client";

const getMessage = (error: unknown) => (error instanceof Error ? error.message : "카테고리 요청 처리 중 오류가 발생했습니다.");

const sortCategories = (categories: Category[]) =>
  [...categories].sort((a, b) => {
    const orderDiff = a.order - b.order;
    if (orderDiff) return orderDiff;
    return a.name.localeCompare(b.name, "ko");
  });

export function useCategories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const loadCategories = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api<{ categories: Category[] }>("/api/categories");
      setCategories(sortCategories(result.categories));
      setError("");
      return result.categories;
    } catch (err) {
      setError(getMessage(err));
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const addCategory = useCallback(async (input: { name: string; description?: string; color?: string; icon?: string }) => {
    setSaving(true);
    try {
      const result = await api<{ category: Category }>("/api/categories", { method: "POST", ...jsonBody(input) });
      setCategories((current) => sortCategories([...current, result.category]));
      setError("");
      return result.category;
    } catch (err) {
      setError(getMessage(err));
      throw err;
    } finally {
      setSaving(false);
    }
  }, []);

  const updateCategory = useCallback(async (id: string, input: Partial<Category>) => {
    const existing = categories.find((category) => category.id === id);
    if (!existing) return undefined;
    setSaving(true);
    try {
      const result = await api<{ category: Category }>(`/api/categories/${id}`, {
        method: "PUT",
        ...jsonBody({ ...existing, ...input }),
      });
      setCategories((current) => sortCategories(current.map((category) => (category.id === id ? result.category : category))));
      setError("");
      return result.category;
    } catch (err) {
      setError(getMessage(err));
      throw err;
    } finally {
      setSaving(false);
    }
  }, [categories]);

  const deleteCategory = useCallback(async (id: string, mode: "moveTodos" | "deleteTodos" = "moveTodos") => {
    setSaving(true);
    try {
      await api(`/api/categories/${id}?mode=${mode}`, { method: "DELETE" });
      setCategories((current) => current.filter((category) => category.id !== id));
      setError("");
    } catch (err) {
      setError(getMessage(err));
      throw err;
    } finally {
      setSaving(false);
    }
  }, []);

  const reorderCategories = useCallback(async (ids: string[]) => {
    const previous = categories;
    const orderMap = new Map(ids.map((id, order) => [id, order]));
    setCategories((current) =>
      sortCategories(
        current.map((category) => ({
          ...category,
          order: orderMap.get(category.id) ?? category.order,
        })),
      ),
    );
    try {
      await api("/api/categories/reorder", { method: "PATCH", ...jsonBody({ ids }) });
      setError("");
    } catch (err) {
      setCategories(previous);
      setError(getMessage(err));
      throw err;
    }
  }, [categories]);

  return {
    categories,
    loading,
    saving,
    error,
    loadCategories,
    addCategory,
    updateCategory,
    deleteCategory,
    reorderCategories,
  };
}
