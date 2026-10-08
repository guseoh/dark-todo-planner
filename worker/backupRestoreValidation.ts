import { BACKUP_KEYS, BACKUP_VERSION, BackupFormatError, type BackupKey } from "./backupFormat";

/**
 * Strict replacement policy: v13 JSON export is the only supported source for
 * destructive /api/backup/import. Legacy local-storage migration remains separate.
 * Some historic tables were not wired into JSON export/import; never silently
 * accept their data as if they would be restored.
 */
export const NON_RESTORABLE_COLLECTIONS = ["learningItems", "todoReminders", "todoDependencies"] as const;
export const FULL_RESTORE_COLLECTIONS = BACKUP_KEYS.filter(
  (key) => !NON_RESTORABLE_COLLECTIONS.some((excluded) => excluded === key),
);

const required: Partial<Record<BackupKey, readonly string[]>> = {
  categories: ["id", "name"],
  projects: ["id", "name"],
  projectDecisions: ["id", "projectId", "title", "decision", "decidedAt"],
  milestones: ["id", "projectId", "title"],
  todos: ["id", "title", "date"],
  reflections: ["id", "date"],
  goals: ["id", "title"],
  memos: ["id", "content"],
  memoTodoLinks: ["memoId", "todoId"],
  memoProjectLinks: ["memoId", "projectId"],
  topics: ["id", "title"],
  topicLinks: ["id", "topicId", "url"],
  musicLinks: ["id", "title", "url"],
  dailyPlans: ["id", "date"],
  weeklyReviews: ["id", "weekStartDate"],
  savedViews: ["id", "name"],
  taskTemplates: ["id", "name"],
  focusSessions: ["id", "startedAt", "endedAt"],
  timerSettings: ["id"],
  timeBlocks: ["id", "title", "date", "startTime", "endTime"],
  plannerSettings: ["id"],
  todoTrash: ["id", "originalTodoId", "title", "deletedAt"],
  routineTemplates: ["id", "name"],
  routineTemplateItems: ["id", "routineId", "title"],
  routineRuns: ["id", "routineId", "targetDate"],
};

const isRecord = (x: unknown): x is Record<string, unknown> => x !== null && typeof x === "object" && !Array.isArray(x);
const populated = (x: unknown): x is string => typeof x === "string" && x.trim().length > 0;
const backupError = (message: string): never => { throw new BackupFormatError(message); };

export function validateFullRestoreBackup(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) throw new BackupFormatError("전체 JSON 백업 객체가 아닙니다.");
  if (value.version !== BACKUP_VERSION) backupError(`전체 복원은 v${BACKUP_VERSION} 백업만 지원합니다. 레거시 자료는 별도의 이전 절차를 사용하세요.`);
  if (!populated(value.exportedAt) || !Number.isFinite(Date.parse(value.exportedAt))) backupError("올바른 백업 생성 시간이 없습니다.");

  for (const key of FULL_RESTORE_COLLECTIONS) {
    const list = value[key];
    if (!Array.isArray(list)) throw new BackupFormatError(`필수 백업 목록 ${key}가 없거나 배열이 아닙니다. 기존 데이터를 보호하기 위해 복원을 중단합니다.`);
    const seen = new Set<string>();
    for (let i = 0; i < list.length; i++) {
      const item: unknown = list[i];
      if (!isRecord(item)) throw new BackupFormatError(`${key}[${i}]가 데이터 객체가 아닙니다.`);
      for (const field of required[key] || []) {
        if (!populated(item[field])) backupError(`${key}[${i}].${field}가 비어 있어 복원 시 누락될 수 있습니다.`);
      }
      // Simple IDs and link-pair keys must not duplicate within their own collection.
      const identity = key === "memoTodoLinks"
        ? `${item.memoId}\0${item.todoId}`
        : key === "memoProjectLinks"
          ? `${item.memoId}\0${item.projectId}`
          : key === "routineRuns"
            ? `${item.routineId}\0${item.targetDate}`
            : populated(item.id) ? item.id : "";
      if (identity && seen.has(identity)) backupError(`${key}에 중복 항목이 있습니다. 안전한 복원이 불가능합니다.`);
      if (identity) seen.add(identity);
    }
  }
  for (const key of NON_RESTORABLE_COLLECTIONS) {
    const list = value[key];
    if (list !== undefined && (!Array.isArray(list) || list.length > 0)) {
      backupError(`${key} 데이터는 현재 전체 JSON 복원에서 보존할 수 없습니다. SQL/D1 백업을 사용하세요.`);
    }
  }
  if (!isRecord(value.scratchpad) || typeof value.scratchpad.content !== "string" || value.scratchpad.content.length > 1_000_000) {
    backupError("낙서장 데이터가 없거나 유효하지 않습니다. 기존 내용 보호를 위해 복원을 중단합니다.");
  }
  const ids = (key: BackupKey) => new Set((value[key] as Array<Record<string, unknown>>).map((item) => item.id));
  const categories = ids("categories"), projects = ids("projects"), milestones = ids("milestones"), todos = ids("todos"), memos = ids("memos");
  const relations: Array<[BackupKey, string, ReadonlySet<unknown>]> = [
    ["milestones", "projectId", projects],
    ["projectDecisions", "projectId", projects],
    ["memoTodoLinks", "memoId", memos],
    ["memoTodoLinks", "todoId", todos],
    ["memoProjectLinks", "memoId", memos],
    ["memoProjectLinks", "projectId", projects],
    ["routineTemplateItems", "routineId", ids("routineTemplates")],
    ["routineRuns", "routineId", ids("routineTemplates")],
    ["topicLinks", "topicId", ids("topics")],
  ];
  for (const [key, field, allowed] of relations) {
    for (const [index, item] of (value[key] as Array<Record<string, unknown>>).entries()) {
      if (!allowed.has(item[field])) backupError(`${key}[${index}]의 ${field}가 백업에 없는 데이터를 참조합니다.`);
    }
  }
  // Core links must not be silently detached during restore.
  for (const [index, item] of (value.todos as Array<Record<string, unknown>>).entries()) {
    for (const [field, allowed] of [["categoryId", categories], ["projectId", projects], ["milestoneId", milestones], ["parentTodoId", todos]] as const) {
      if (item[field] && !allowed.has(item[field])) backupError(`todos[${index}].${field} 참조가 복원할 백업에 없습니다.`);
    }
  }
  for (const [index, item] of (value.taskTemplates as Array<Record<string, unknown>>).entries()) {
    if (!isRecord(item.todo) || !populated(item.todo.title)) backupError(`taskTemplates[${index}]의 Todo 템플릿 내용이 유효하지 않습니다.`);
  }
  return value;
}
