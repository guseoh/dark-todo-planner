import { useCallback, useState } from "react";
import { api, jsonBody } from "../lib/api/client";

const getMessage = (error: unknown) => (error instanceof Error ? error.message : "백업 요청 처리 중 오류가 발생했습니다.");

export function useBackup(onImported: () => Promise<void>) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const exportBackup = useCallback(() => api<Record<string, unknown>>("/api/backup/export"), []);

  const importBackup = useCallback(async (data: unknown) => {
    setSaving(true);
    try {
      const result = await api<Record<string, unknown>>("/api/backup/import", { method: "POST", ...jsonBody(data) });
      await onImported();
      setError("");
      return result;
    } catch (err) {
      setError(getMessage(err));
      throw err;
    } finally {
      setSaving(false);
    }
  }, [onImported]);

  const migrateLocalStorage = useCallback(async (data: unknown) => {
    setSaving(true);
    try {
      const result = await api<Record<string, unknown>>("/api/migrate/local-storage", { method: "POST", ...jsonBody(data) });
      await onImported();
      setError("");
      return result;
    } catch (err) {
      setError(getMessage(err));
      throw err;
    } finally {
      setSaving(false);
    }
  }, [onImported]);

  return {
    saving,
    error,
    exportBackup,
    importBackup,
    migrateLocalStorage,
  };
}
