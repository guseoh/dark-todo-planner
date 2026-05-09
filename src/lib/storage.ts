import type { BackupData } from "../types/backup";
import type { Goal } from "../types/goal";
import type { Reflection, ReflectionType } from "../types/reflection";
import type { Todo, TodoPriority, TodoRepeat } from "../types/todo";
import { LEGACY_STORAGE_KEYS, STORAGE_KEYS } from "./storageKeys";

export const TODO_STORAGE_KEY = STORAGE_KEYS.TODOS;
export const BACKUP_VERSION = 6;

const priorities: TodoPriority[] = ["LOW", "MEDIUM", "HIGH"];
const repeats: TodoRepeat[] = ["NONE", "DAILY", "WEEKLY", "MONTHLY", "WEEKDAY", "WEEKEND"];
const reflectionTypes: ReflectionType[] = ["DAILY", "WEEKLY", "MONTHLY"];

const isString = (value: unknown): value is string => typeof value === "string";
const isNumber = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const isBoolean = (value: unknown): value is boolean => typeof value === "boolean";

export const readJson = <T,>(key: string, fallback: T): T => {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
};

export const writeJson = (key: string, value: unknown) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
};

const normalizeOptional = (value: unknown) => (isString(value) && value.trim() ? value.trim() : undefined);

export const parseTags = (value: string | string[] | undefined): string[] => {
  const source = Array.isArray(value) ? value : value?.split(",") || [];
  return Array.from(
    new Set(
      source
        .map((tag) => tag.trim().replace(/^#/, ""))
        .filter(Boolean),
    ),
  );
};

export const normalizeTodo = (value: unknown): Todo | null => {
  if (!value || typeof value !== "object") return null;
  const todo = value as Partial<Todo>;
  if (!isString(todo.id) || !isString(todo.title) || !isString(todo.date)) return null;
  if (!priorities.includes(todo.priority as TodoPriority)) return null;
  if (!isString(todo.createdAt) || !isString(todo.updatedAt)) return null;

  return {
    id: todo.id,
    title: todo.title,
    memo: normalizeOptional(todo.memo),
    date: todo.date,
    startTime: normalizeOptional(todo.startTime),
    endTime: normalizeOptional(todo.endTime),
    priority: todo.priority as TodoPriority,
    completed: isBoolean(todo.completed) ? todo.completed : false,
    createdAt: todo.createdAt,
    updatedAt: todo.updatedAt,
    repeat: repeats.includes(todo.repeat as TodoRepeat) ? (todo.repeat as TodoRepeat) : "NONE",
    tags: parseTags(todo.tags),
    archived: isBoolean(todo.archived) ? todo.archived : false,
    archivedAt: normalizeOptional(todo.archivedAt),
  };
};

export const validateTodos = (value: unknown): Todo[] | null => {
  if (!Array.isArray(value)) return null;
  const normalized = value.map(normalizeTodo);
  if (normalized.some((todo) => todo === null)) return null;
  return normalized as Todo[];
};

export const loadTodos = (): Todo[] => {
  if (typeof window === "undefined") return [];
  const current = validateTodos(readJson<unknown>(STORAGE_KEYS.TODOS, null));
  if (current) return current;

  const legacy = validateTodos(readJson<unknown>(LEGACY_STORAGE_KEYS.TODOS, null));
  if (legacy) {
    writeJson(STORAGE_KEYS.TODOS, legacy);
    return legacy;
  }
  return [];
};

export const saveTodos = (todos: Todo[]) => {
  writeJson(STORAGE_KEYS.TODOS, todos.map((todo) => normalizeTodo(todo)).filter(Boolean));
};

export const normalizeReflection = (value: unknown): Reflection | null => {
  if (!value || typeof value !== "object") return null;
  const reflection = value as Partial<Reflection>;
  if (
    !isString(reflection.id) ||
    !isString(reflection.date) ||
    !reflectionTypes.includes(reflection.type as ReflectionType) ||
    !isString(reflection.content) ||
    !isString(reflection.createdAt) ||
    !isString(reflection.updatedAt)
  ) {
    return null;
  }
  return reflection as Reflection;
};

export const validateReflections = (value: unknown): Reflection[] | null => {
  if (!Array.isArray(value)) return null;
  const normalized = value.map(normalizeReflection);
  if (normalized.some((reflection) => reflection === null)) return null;
  return normalized as Reflection[];
};

export const normalizeGoal = (value: unknown): Goal | null => {
  if (!value || typeof value !== "object") return null;
  const goal = value as Partial<Goal>;
  if (
    !isString(goal.id) ||
    !isString(goal.title) ||
    !isString(goal.dueDate) ||
    !isNumber(goal.progress) ||
    !isBoolean(goal.completed) ||
    !isString(goal.createdAt) ||
    !isString(goal.updatedAt)
  ) {
    return null;
  }
  return {
    id: goal.id,
    title: goal.title,
    description: normalizeOptional(goal.description),
    type: (goal as Partial<Goal>).type || "DAILY",
    targetDate: (goal as Partial<Goal>).targetDate || goal.dueDate,
    weekStartDate: (goal as Partial<Goal>).weekStartDate,
    weekEndDate: (goal as Partial<Goal>).weekEndDate,
    month: (goal as Partial<Goal>).month,
    dueDate: goal.dueDate,
    progress: Math.min(100, Math.max(0, Math.round(goal.progress))),
    completed: goal.completed,
    createdAt: goal.createdAt,
    updatedAt: goal.updatedAt,
  };
};

export const validateGoals = (value: unknown): Goal[] | null => {
  if (!Array.isArray(value)) return null;
  const normalized = value.map(normalizeGoal);
  if (normalized.some((goal) => goal === null)) return null;
  return normalized as Goal[];
};

export const buildBackupData = (input: Omit<BackupData, "version" | "exportedAt">): BackupData => ({
  version: BACKUP_VERSION,
  exportedAt: new Date().toISOString(),
  todos: input.todos || [],
  reflections: input.reflections || [],
  goals: input.goals || [],
  memos: input.memos || [],
  topics: input.topics || [],
  topicLinks: input.topicLinks || [],
  musicLinks: input.musicLinks || [],
});

export const validateBackupData = (value: unknown): { data?: BackupData; error?: string } => {
  if (Array.isArray(value)) {
    const todos = validateTodos(value);
    return todos ? { data: buildBackupData({ todos }) } : { error: "Todo 배열 구조가 올바르지 않습니다." };
  }

  if (!value || typeof value !== "object") return { error: "백업 JSON 객체가 아닙니다." };
  const backup = value as Partial<BackupData>;
  const version = isNumber(backup.version) ? backup.version : undefined;

  const todos = backup.todos === undefined ? [] : validateTodos(backup.todos);
  if (!todos) return { error: "todos 필드는 배열이어야 하며 Todo 구조가 올바라야 합니다." };

  const reflections = backup.reflections === undefined ? [] : validateReflections(backup.reflections);
  if (!reflections) return { error: "reflections 데이터 구조가 올바르지 않습니다." };

  const goals = backup.goals === undefined ? [] : validateGoals(backup.goals);
  if (!goals) return { error: "goals 데이터 구조가 올바르지 않습니다." };

  return {
    data: {
      version,
      exportedAt: isString(backup.exportedAt) ? backup.exportedAt : new Date().toISOString(),
      todos,
      reflections,
      goals,
      memos: Array.isArray(backup.memos) ? backup.memos : [],
      topics: Array.isArray(backup.topics) ? backup.topics : [],
      topicLinks: Array.isArray(backup.topicLinks) ? backup.topicLinks : [],
      musicLinks: Array.isArray(backup.musicLinks) ? backup.musicLinks : [],
    },
  };
};
