/** Importing a full backup is destructive. Reject partial and legacy files in the UI. */
export const RESTORABLE_BACKUP_VERSION = 13;
const REQUIRED_COLLECTIONS = ["todos", "categories", "projects", "memos"] as const;

export type BackupRestorePreview = {
  payload: Record<string, unknown>;
  version: number;
  exportedAt: string;
  counts: Record<(typeof REQUIRED_COLLECTIONS)[number], number>;
};

export function validateRestorableBackup(value: unknown): BackupRestorePreview {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("전체 백업 JSON 객체를 선택해주세요.");
  }
  const payload = value as Record<string, unknown>;
  if (payload.version !== RESTORABLE_BACKUP_VERSION) {
    throw new Error(`현재 복원 화면은 v${RESTORABLE_BACKUP_VERSION} 전체 백업만 지원합니다. 이전 버전은 검증 없이 복원하지 않습니다.`);
  }
  if (typeof payload.exportedAt !== "string" || !Number.isFinite(Date.parse(payload.exportedAt))) {
    throw new Error("내보낸 시각이 없는 파일은 전체 백업으로 확인할 수 없습니다.");
  }
  const counts = {} as BackupRestorePreview["counts"];
  for (const key of REQUIRED_COLLECTIONS) {
    if (!Array.isArray(payload[key])) {
      throw new Error(`${key} 데이터가 없는 부분 백업은 복원할 수 없습니다.`);
    }
    counts[key] = (payload[key] as unknown[]).length;
  }
  return { payload, version: RESTORABLE_BACKUP_VERSION, exportedAt: payload.exportedAt, counts };
}
