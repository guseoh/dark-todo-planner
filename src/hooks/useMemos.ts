import { useCallback, useRef, useState } from "react";
import { api, apiAllPages, jsonBody } from "../lib/api/client";
import type { Memo, MemoInput } from "../types/memo";

const DELETE_UNDO_MS = 6000;
const getMessage = (error: unknown) => (error instanceof Error ? error.message : "메모 요청 처리 중 오류가 발생했습니다.");

export type PendingMemoDelete = {
  id: string;
  label: string;
  createdAt: number;
};

export function useMemos() {
  const [memos, setMemos] = useState<Memo[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [pendingDelete, setPendingDelete] = useState<PendingMemoDelete | null>(null);
  const deleteTimersRef = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const deletedSnapshotsRef = useRef(new Map<string, Memo>());

  const loadMemos = useCallback(async () => {
    setLoading(true);
    try {
      const memos = await apiAllPages<Memo>("/api/memos", "memos");
      setMemos(memos);
      setError("");
      return memos;
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

  const finalizeDelete = useCallback(async (id: string) => {
    const snapshot = deletedSnapshotsRef.current.get(id);
    try {
      await api(`/api/memos/${id}`, { method: "DELETE" });
      setError("");
      deletedSnapshotsRef.current.delete(id);
    } catch (err) {
      if (snapshot) {
        setMemos((current) =>
          current.some((memo) => memo.id === snapshot.id)
            ? current
            : [snapshot, ...current].sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt.localeCompare(a.updatedAt)),
        );
      }
      setError(getMessage(err));
    } finally {
      deleteTimersRef.current.delete(id);
      setPendingDelete((current) => (current?.id === id ? null : current));
    }
  }, []);

  const deleteMemo = useCallback((id: string) => {
    const memo = memos.find((item) => item.id === id);
    if (!memo) return;

    const existingTimer = deleteTimersRef.current.get(id);
    if (existingTimer) clearTimeout(existingTimer);

    deletedSnapshotsRef.current.set(id, memo);
    setMemos((current) => current.filter((item) => item.id !== id));
    setPendingDelete({
      id,
      label: memo.title || memo.content.split("\n").find(Boolean)?.slice(0, 28) || "메모",
      createdAt: Date.now(),
    });

    const timer = setTimeout(() => void finalizeDelete(id), DELETE_UNDO_MS);
    deleteTimersRef.current.set(id, timer);
  }, [finalizeDelete, memos]);

  const undoDeleteMemo = useCallback(() => {
    const pending = pendingDelete;
    if (!pending) return;
    const timer = deleteTimersRef.current.get(pending.id);
    if (timer) clearTimeout(timer);
    deleteTimersRef.current.delete(pending.id);
    const snapshot = deletedSnapshotsRef.current.get(pending.id);
    deletedSnapshotsRef.current.delete(pending.id);
    if (snapshot) {
      setMemos((current) =>
        current.some((memo) => memo.id === snapshot.id)
          ? current
          : [snapshot, ...current].sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt.localeCompare(a.updatedAt)),
      );
    }
    setPendingDelete(null);
  }, [pendingDelete]);

  return {
    memos,
    loading,
    saving,
    error,
    pendingDelete,
    loadMemos,
    addMemo,
    updateMemo,
    toggleMemoPin,
    deleteMemo,
    undoDeleteMemo,
  };
}
