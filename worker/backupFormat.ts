export const BACKUP_VERSION = 9;
export const SUPPORTED_BACKUP_VERSIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;
export const BACKUP_KEYS = [
  "categories", "projects", "projectDecisions", "milestones", "todos", "reflections", "goals", "memos",
  "memoTodoLinks", "memoProjectLinks", "topics", "topicLinks", "musicLinks",
  "dailyPlans", "weeklyReviews", "savedViews", "taskTemplates", "focusSessions", "timerSettings", "timeBlocks", "plannerSettings", "todoTrash",
] as const;

export type BackupKey = (typeof BACKUP_KEYS)[number];
export type BackupItem = Record<string, unknown>;
export type BackupPayload = { version?: number; exportedAt?: string } & Partial<Record<BackupKey, BackupItem[]>>;
export class BackupFormatError extends Error {}

const asItems = (value: unknown) => Array.isArray(value) ? value.filter((item): item is BackupItem => !!item && typeof item === "object" && !Array.isArray(item)) : [];

export const normalizeBackupPayload = (input: unknown): { data: BackupPayload; warnings: string[] } => {
  if (Array.isArray(input)) return { data: { todos: asItems(input) }, warnings: ["버전 없는 Todo 배열을 legacy 백업으로 처리했습니다."] };
  if (!input || typeof input !== "object") throw new BackupFormatError("백업 JSON은 객체 또는 Todo 배열이어야 합니다.");
  const source = input as BackupItem;
  const warnings: string[] = [];
  const data: BackupPayload = {};
  if (source.version != null) {
    const version = Number(source.version);
    if (Number.isInteger(version)) data.version = version;
    else warnings.push("백업 버전이 올바르지 않아 legacy 형식으로 처리했습니다.");
  }
  if (typeof source.exportedAt === "string") data.exportedAt = source.exportedAt;
  for (const key of BACKUP_KEYS) {
    if (source[key] != null && !Array.isArray(source[key])) warnings.push(`${key} 필드가 배열이 아니어서 건너뛰었습니다.`);
    data[key] = asItems(source[key]);
  }
  return { data, warnings };
};

export type BackupRelationReferences = { projectIds: ReadonlySet<string>; todoIds: ReadonlySet<string>; memoIds: ReadonlySet<string> };
export type NormalizedProjectDecision = { id: string; projectId: string; title: string; decision: string; rationale?: string; decidedAt: string; createdAt: string; updatedAt: string };
export type NormalizedMemoTodoLink = { memoId: string; todoId: string; createdAt: string };
export type NormalizedMemoProjectLink = { memoId: string; projectId: string; createdAt: string };

const requiredString = (value: unknown) => typeof value === "string" && value.trim() ? value.trim() : "";
const optionalString = (value: unknown) => typeof value === "string" && value.trim() ? value : undefined;
const timestamp = (value: unknown, fallback: string) => typeof value === "string" && value ? value : fallback;

export const normalizeBackupV8Relations = (data: BackupPayload, refs: BackupRelationReferences, now: string) => {
  const projectDecisions: NormalizedProjectDecision[] = [];
  const memoTodoLinks: NormalizedMemoTodoLink[] = [];
  const memoProjectLinks: NormalizedMemoProjectLink[] = [];
  const skipped = { projectDecisions: 0, memoTodoLinks: 0, memoProjectLinks: 0 };
  const decisionIds = new Set<string>();
  for (const item of data.projectDecisions || []) {
    const id = requiredString(item.id), projectId = requiredString(item.projectId), title = requiredString(item.title), decision = requiredString(item.decision), decidedAt = requiredString(item.decidedAt);
    if (!id || decisionIds.has(id) || !projectId || !refs.projectIds.has(projectId) || !title || !decision || !decidedAt) { skipped.projectDecisions++; continue; }
    decisionIds.add(id);
    projectDecisions.push({ id, projectId, title, decision, rationale: optionalString(item.rationale), decidedAt, createdAt: timestamp(item.createdAt, now), updatedAt: timestamp(item.updatedAt, now) });
  }
  const todoLinkKeys = new Set<string>();
  for (const item of data.memoTodoLinks || []) {
    const memoId = requiredString(item.memoId), todoId = requiredString(item.todoId), key = `${memoId}\u0000${todoId}`;
    if (!memoId || !todoId || !refs.memoIds.has(memoId) || !refs.todoIds.has(todoId) || todoLinkKeys.has(key)) { skipped.memoTodoLinks++; continue; }
    todoLinkKeys.add(key); memoTodoLinks.push({ memoId, todoId, createdAt: timestamp(item.createdAt, now) });
  }
  const projectLinkKeys = new Set<string>();
  for (const item of data.memoProjectLinks || []) {
    const memoId = requiredString(item.memoId), projectId = requiredString(item.projectId), key = `${memoId}\u0000${projectId}`;
    if (!memoId || !projectId || !refs.memoIds.has(memoId) || !refs.projectIds.has(projectId) || projectLinkKeys.has(key)) { skipped.memoProjectLinks++; continue; }
    projectLinkKeys.add(key); memoProjectLinks.push({ memoId, projectId, createdAt: timestamp(item.createdAt, now) });
  }
  return { projectDecisions, memoTodoLinks, memoProjectLinks, skipped };
};
