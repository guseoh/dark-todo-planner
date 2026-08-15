import { useCallback, useRef, useState } from "react";
import { api, apiAllPages, jsonBody } from "../lib/api/client";
import type { Memo, MemoInput, MemoLinksInput } from "../types/memo";

const DELETE_UNDO_MS = 6000;
const getMessage = (error: unknown) => (error instanceof Error ? error.message : "메모 요청 처리 중 오류가 발생했습니다.");

export type PendingMemoDelete = {
  id: string;
  label: string;
  createdAt: number;
};

const normalizeMemo = (memo: Memo): Memo => ({ ...memo, todoIds: memo.todoIds || [], projectIds: memo.projectIds || [] });

export function useMemos() {
  const [memos, setMemos] = useState<Memo[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [pendingDelete, setPendingDelete] = useState<PendingMemoDelete | null>(null);
  const deleteTimersRef = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const deletedSnapshotsRef = useRef(new Map<string, Memo>());

  const sortMemos = (items: Memo[]) => [...items].sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt.localeCompare(a.updatedAt));

  const loadMemos = useCallback(async () => {
    setLoading(true);
    try {
      const rows = (await apiAllPages<Memo>("/api/memos", "memos")).map(normalizeMemo);
      setMemos(rows);
      setError("");
      return rows;
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
      const result = await api<{ memo: Memo }>("/api/memos", { method: "POST", ...jsonBody(input) });
      const memo = normalizeMemo(result.memo);
      setMemos((current) => sortMemos([memo, ...current]));
      setError("");
      return memo;
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
      const result = await api<{ memo: Memo }>(`/api/memos/${id}`, { method: "PUT", ...jsonBody(input) });
      const memo = normalizeMemo(result.memo);
      setMemos((current) => sortMemos(current.map((item) => (item.id === id ? memo : item))));
      setError("");
      return memo;
    } catch (err) {
      setError(getMessage(err));
      throw err;
    } finally {
      setSaving(false);
    }
  }, []);

  const updateMemoLinks = useCallback(async (id: string, input: MemoLinksInput) => {
    setSaving(true);
    try {
      const result = await api<{ memo: Memo }>(`/api/memos/${id}/links`, { method: "PUT", ...jsonBody(input) });
      const memo = normalizeMemo(result.memo);
      setMemos((current) => sortMemos(current.map((item) => (item.id === id ? memo : item))));
      setError("");
      return memo;
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
      const memo = normalizeMemo(result.memo);
      setMemos((current) => sortMemos(current.map((item) => (item.id === id ? memo : item))));
      setError("");
      return memo;
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
      if (snapshot) setMemos((current) => current.some((memo) => memo.id === snapshot.id) ? current : sortMemos([snapshot, ...current]));
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
    setPendingDelete({ id, label: memo.title || memo.content.split("\n").find(Boolean)?.slice(0, 28) || "메모", createdAt: Date.now() });
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
    if (snapshot) setMemos((current) => current.some((memo) => memo.id === snapshot.id) ? current : sortMemos([snapshot, ...current]));
    setPendingDelete(null);
  }, [pendingDelete]);

  return {
    memos, loading, saving, error, pendingDelete,
    loadMemos, addMemo, updateMemo, updateMemoLinks, toggleMemoPin, deleteMemo, undoDeleteMemo,
  };
}
