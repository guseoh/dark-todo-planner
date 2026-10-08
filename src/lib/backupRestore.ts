import { BACKUP_VERSION } from "../../worker/backupFormat";
import { validateFullRestoreBackup, FULL_RESTORE_COLLECTIONS } from "../../worker/backupRestoreValidation";

/** Same fail-closed v13 full-replacement policy as the Worker. */
export const RESTORABLE_BACKUP_VERSION = BACKUP_VERSION;
const PREVIEW_KEYS = ["todos", "categories", "projects", "memos"] as const;

export type BackupRestorePreview = {
  payload: Record<string, unknown>;
  version: number;
  exportedAt: string;
  counts: Record<(typeof PREVIEW_KEYS)[number], number>;
  collectionCount: number;
};

export function validateRestorableBackup(value: unknown): BackupRestorePreview {
  const payload = validateFullRestoreBackup(value);
  const counts = {} as BackupRestorePreview["counts"];
  for (const key of PREVIEW_KEYS) counts[key] = (payload[key] as unknown[]).length;
  return { payload, version: RESTORABLE_BACKUP_VERSION, exportedAt: payload.exportedAt as string, counts, collectionCount: FULL_RESTORE_COLLECTIONS.length };
}
