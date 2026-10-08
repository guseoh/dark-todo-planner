/** Collections genuinely exported and restored by the current v13 JSON endpoints. */
export const RESTORABLE_BACKUP_VERSION = 13;
export const FULL_RESTORE_COLLECTIONS = [
  "categories", "projects", "projectDecisions", "milestones", "todos", "reflections", "goals", "memos",
  "memoTodoLinks", "memoProjectLinks", "topics", "topicLinks", "musicLinks",
  "dailyPlans", "weeklyReviews", "savedViews", "taskTemplates", "focusSessions", "timerSettings", "timeBlocks", "plannerSettings", "todoTrash",
  "routineTemplates", "routineTemplateItems", "routineRuns",
] as const;
const isRecord = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value);
const PREVIEW_KEYS = ["todos", "categories", "projects", "memos"] as const;
export type BackupRestorePreview = {
  payload: Record<string, unknown>;
  version: number;
  exportedAt: string;
  counts: Record<(typeof PREVIEW_KEYS)[number], number>;
  collectionCount: number;
};

/** Browser preview intentionally validates shape; the Worker enforces row/relationship integrity. */
export function validateRestorableBackup(value: unknown): BackupRestorePreview {
  if (!isRecord(value)) throw new Error("전체 JSON 백업 객체가 아닙니다.");
  if (value.version !== RESTORABLE_BACKUP_VERSION) throw new Error(`v${RESTORABLE_BACKUP_VERSION} JSON 백업만 전체 복원할 수 있습니다.`);
  if (typeof value.exportedAt !== "string" || !Number.isFinite(Date.parse(value.exportedAt))) throw new Error("올바른 내보낸 시간이 없습니다.");
  for (const key of FULL_RESTORE_COLLECTIONS) {
    const items = value[key];
    if (!Array.isArray(items) || !items.every(isRecord)) throw new Error(`${key} 컬렉션이 없거나 유효하지 않습니다.`);
  }
  if (!isRecord(value.scratchpad) || typeof value.scratchpad.content !== "string") throw new Error("낙서장 데이터가 없거나 유효하지 않습니다.");
  for (const key of ["learningItems", "todoReminders", "todoDependencies"]) {
    const items = value[key];
    if (items !== undefined && (!Array.isArray(items) || items.length > 0)) throw new Error(`${key}는 JSON 전체 복원이 지원하지 않습니다.`);
  }
  const counts = {} as BackupRestorePreview["counts"];
  for (const key of PREVIEW_KEYS) counts[key] = (value[key] as unknown[]).length;
  return { payload: value, version: RESTORABLE_BACKUP_VERSION, exportedAt: value.exportedAt, counts, collectionCount: FULL_RESTORE_COLLECTIONS.length };
}
