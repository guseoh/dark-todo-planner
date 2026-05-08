import { useCallback, useState } from "react";
import { api, jsonBody } from "../lib/api/client";
import type { Memo, MemoInput } from "../types/memo";

const getMessage = (error: unknown) => (error instanceof Error ? error.message : "메모 요청 처리 중 오류가 발생했습니다.");

export function useMemos() {
  const [memos, setMemos] = useState<Memo[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const loadMemos = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api<{ memos: Memo[] }>("/api/memos");
      setMemos(result.memos);
      setError("");
      return result.memos;
    } catch (err) {
      setError(getMessage(err));
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const addMemo = useCallback(async (input: MemoInput) => {
    setSaving(true);
    try {
      const result = await api<{ memo: Memo }>("/api/memos", {
        method: "POST",
        ...jsonBody(input),
      });
      setMemos((current) => [result.memo, ...current].sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt.localeCompare(a.updatedAt)));
      setError("");
      return result.memo;
    } catch (err) {
      setError(getMessage(err));
      throw err;
    } finally {
      setSaving(false);
    }
  }, []);

  const updateMemo = useCallback(async (id: string, input: MemoInput) => {
    setSaving(true);
    try {
      const result = await api<{ memo: Memo }>(`/api/memos/${id}`, {
        method: "PUT",
        ...jsonBody(input),
      });
      setMemos((current) =>
        current
          .map((memo) => (memo.id === id ? result.memo : memo))
          .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt.localeCompare(a.updatedAt)),
      );
      setError("");
      return result.memo;
    } catch (err) {
      setError(getMessage(err));
      throw err;
    } finally {
      setSaving(false);
    }
  }, []);

  const toggleMemoPin = useCallback(async (id: string) => {
    try {
      const result = await api<{ memo: Memo }>(`/api/memos/${id}/pin`, { method: "PATCH" });
      setMemos((current) =>
        current
          .map((memo) => (memo.id === id ? result.memo : memo))
          .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt.localeCompare(a.updatedAt)),
      );
      setError("");
      return result.memo;
    } catch (err) {
      setError(getMessage(err));
      throw err;
    }
  }, []);

  const deleteMemo = useCallback(async (id: string) => {
    const previous = memos;
    setMemos((current) => current.filter((memo) => memo.id !== id));
    try {
      await api(`/api/memos/${id}`, { method: "DELETE" });
      setError("");
    } catch (err) {
      setMemos(previous);
      setError(getMessage(err));
      throw err;
    }
  }, [memos]);

  return {
    memos,
    loading,
    saving,
    error,
    loadMemos,
    addMemo,
    updateMemo,
    toggleMemoPin,
    deleteMemo,
  };
}
