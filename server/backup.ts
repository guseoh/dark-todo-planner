import { prisma } from "./db";
import { BACKUP_COLLECTION_KEYS, BACKUP_VERSION, SUPPORTED_BACKUP_VERSIONS, type BackupCollectionKey } from "./backupConstants";
import { normalizeCategoryIcon } from "./categoryIcon";

export type BackupData = {
  version?: number;
  exportedAt?: string;
  categories?: Record<string, any>[];
  todos?: Record<string, any>[];
  reflections?: Record<string, any>[];
  goals?: Record<string, any>[];
  memos?: Record<string, any>[];
  topics?: Record<string, any>[];
  topicLinks?: Record<string, any>[];
  musicLinks?: Record<string, any>[];
};

type NormalizedBackupData = Required<Pick<BackupData, BackupCollectionKey>> & {
  version?: number;
  exportedAt?: string;
  warnings: string[];
};

export class BackupValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BackupValidationError";
  }
}

const normalizeOptional = (value?: string | null) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

const parseTags = (tags?: unknown) =>
  Array.isArray(tags)
    ? Array.from(new Set(tags.map((tag) => String(tag).trim().replace(/^#/, "")).filter(Boolean)))
    : [];

const todoPriorities = ["LOW", "MEDIUM", "HIGH"] as const;
const repeatTypes = ["NONE", "DAILY", "WEEKLY", "MONTHLY", "WEEKDAY", "WEEKEND"] as const;
const topicStatuses = ["IDEA", "WRITING", "DONE"] as const;
const reflectionTypes = ["DAILY", "WEEKLY", "MONTHLY"] as const;
const goalTypes = ["DAILY", "WEEKLY", "MONTHLY"] as const;

const isObject = (value: unknown): value is Record<string, any> => !!value && typeof value === "object" && !Array.isArray(value);

const pickEnum = <T extends readonly string[]>(value: unknown, values: T, fallback: T[number]): T[number] =>
  values.includes(String(value) as T[number]) ? (String(value) as T[number]) : fallback;

const readBackupArray = (source: Record<string, any>, key: BackupCollectionKey, warnings: string[]) => {
  const value = source[key];
  if (value === undefined || value === null) return [];
  if (Array.isArray(value)) return value;
  warnings.push(`${key} 필드가 배열이 아니어서 건너뛰었습니다.`);
  return [];
};

const normalizeBackupData = (value: unknown): NormalizedBackupData => {
  if (Array.isArray(value)) {
    return {
      version: undefined,
      exportedAt: undefined,
      categories: [],
      todos: value,
      reflections: [],
      goals: [],
      memos: [],
      topics: [],
      topicLinks: [],
      musicLinks: [],
      warnings: ["version이 없는 Todo 배열 형식 백업을 legacy backup으로 처리했습니다."],
    };
  }

  if (!isObject(value)) {
    throw new BackupValidationError("백업 JSON은 객체이거나 Todo 배열이어야 합니다.");
  }

  const warnings: string[] = [];
  const rawVersion = value.version;
  const version = Number(rawVersion);

  if (rawVersion === undefined || rawVersion === null || rawVersion === "") {
    warnings.push("version이 없어 legacy backup으로 처리했습니다.");
  } else if (!Number.isInteger(version)) {
    warnings.push(`백업 파일 version 값이 숫자가 아니어서 legacy backup으로 처리했습니다. 입력값: ${String(rawVersion)}`);
  } else if (!SUPPORTED_BACKUP_VERSIONS.includes(version as (typeof SUPPORTED_BACKUP_VERSIONS)[number])) {
    warnings.push(
      `백업 파일 버전: ${version}. 지원 버전: ${SUPPORTED_BACKUP_VERSIONS.join(", ")}. 알 수 없는 버전이지만 호환 가능한 필드는 가져옵니다.`,
    );
  }

  return {
    version: Number.isInteger(version) ? version : undefined,
    exportedAt: typeof value.exportedAt === "string" ? value.exportedAt : undefined,
    categories: readBackupArray(value, "categories", warnings),
    todos: readBackupArray(value, "todos", warnings),
    reflections: readBackupArray(value, "reflections", warnings),
    goals: readBackupArray(value, "goals", warnings),
    memos: readBackupArray(value, "memos", warnings),
    topics: readBackupArray(value, "topics", warnings),
    topicLinks: readBackupArray(value, "topicLinks", warnings),
    musicLinks: readBackupArray(value, "musicLinks", warnings),
    warnings,
  };
};

export const importBackupForUser = async (userId: string, input: unknown) => {
  const data = normalizeBackupData(input);
  const imported = {
    categories: 0,
    todos: 0,
    reflections: 0,
    goals: 0,
    memos: 0,
    topics: 0,
    topicLinks: 0,
    musicLinks: 0,
  };

  await prisma.$transaction(async (tx) => {
    await tx.topicLink.deleteMany({ where: { topic: { userId } } });
    await tx.topic.deleteMany({ where: { userId } });
    await tx.musicLink.deleteMany({ where: { userId } });
    await tx.todoTag.deleteMany({ where: { todo: { userId } } });
    await tx.todo.deleteMany({ where: { userId } });
    await tx.tag.deleteMany({ where: { userId } });
    await tx.category.deleteMany({ where: { userId } });
    await tx.reflection.deleteMany({ where: { userId } });
    await tx.goal.deleteMany({ where: { userId } });
    await tx.memo.deleteMany({ where: { userId } });

    const categoryIds = new Set<string>();
    for (const category of data.categories || []) {
      if (!category?.id || !category?.name) continue;
      categoryIds.add(category.id);
      await tx.category.create({
        data: {
          id: category.id,
          userId,
          name: String(category.name),
          description: normalizeOptional(category.description),
          color: category.color || "#6366f1",
          icon: normalizeCategoryIcon(category.icon),
          order: Number(category.order) || 0,
        },
      });
      imported.categories += 1;
    }

    for (const todo of data.todos || []) {
      if (!todo?.id || !todo?.title || !todo?.date) continue;
      const categoryId = todo.categoryId && categoryIds.has(todo.categoryId) ? todo.categoryId : null;
      await tx.todo.create({
        data: {
          id: todo.id,
          userId,
          categoryId,
          title: todo.title,
          memo: normalizeOptional(todo.memo),
          date: String(todo.date),
          startTime: normalizeOptional(todo.startTime),
          endTime: normalizeOptional(todo.endTime),
          priority: pickEnum(todo.priority, todoPriorities, "MEDIUM"),
          completed: !!todo.completed,
          repeat: pickEnum(todo.repeat, repeatTypes, "NONE"),
          archived: !!todo.archived,
          archivedAt: todo.archivedAt ? new Date(todo.archivedAt) : null,
          order: Number(todo.order) || 0,
        },
      });
      imported.todos += 1;
      for (const name of parseTags(todo.tags)) {
        const tag = await tx.tag.upsert({
          where: { userId_name: { userId, name } },
          update: {},
          create: { userId, name },
        });
        await tx.todoTag.create({ data: { todoId: todo.id, tagId: tag.id } });
      }
    }

    const topicIds = new Set<string>();
    for (const topic of data.topics || []) {
      if (!topic?.id || !topic?.title) continue;
      topicIds.add(topic.id);
      await tx.topic.create({
        data: {
          id: topic.id,
          userId,
          title: String(topic.title),
          memo: normalizeOptional(topic.memo),
          status: pickEnum(topic.status, topicStatuses, "IDEA"),
          tagsJson: JSON.stringify(parseTags(topic.tags)),
        },
      });
      imported.topics += 1;
    }

    const topicLinkMap = new Map<string, any>();
    const collectTopicLink = (link: any) => {
      if (!link?.url || !link?.topicId) return;
      const key = link.id || `${link.topicId}:${link.url}`;
      if (!topicLinkMap.has(key)) topicLinkMap.set(key, link);
    };
    (data.topicLinks || []).forEach(collectTopicLink);
    (data.topics || []).forEach((topic: any) => {
      if (!Array.isArray(topic?.links)) return;
      topic.links.forEach((link: any) => collectTopicLink({ ...link, topicId: topic.id }));
    });
    const topicLinks = Array.from(topicLinkMap.values());
    for (const link of topicLinks) {
      if (!link?.url || !link?.topicId || !topicIds.has(link.topicId)) continue;
      await tx.topicLink.create({
        data: {
          id: link.id || undefined,
          topicId: link.topicId,
          title: normalizeOptional(link.title),
          url: String(link.url),
          description: normalizeOptional(link.description),
        },
      });
      imported.topicLinks += 1;
    }

    for (const link of data.musicLinks || []) {
      if (!link?.id || !link?.title || !link?.url) continue;
      await tx.musicLink.create({
        data: {
          id: link.id,
          userId,
          title: link.title,
          url: String(link.url),
          provider: link.provider || "ETC",
          memo: normalizeOptional(link.memo),
        },
      });
      imported.musicLinks += 1;
    }

    for (const memo of data.memos || []) {
      if (!memo?.id || !memo?.content) continue;
      await tx.memo.create({
        data: {
          id: memo.id,
          userId,
          title: normalizeOptional(memo.title),
          content: String(memo.content),
          color: normalizeOptional(memo.color),
          pinned: !!memo.pinned,
        },
      });
      imported.memos += 1;
    }

    for (const reflection of data.reflections || []) {
      if (!reflection?.id || !reflection?.date) continue;
      const sections = Array.isArray(reflection.sections)
        ? reflection.sections
        : reflection.content
          ? [{ id: "legacy-content", title: "기존 회고", content: reflection.content, order: 0 }]
          : [];
      await tx.reflection.create({
        data: {
          id: reflection.id,
          userId,
          date: String(reflection.date),
          type: pickEnum(reflection.type, reflectionTypes, "DAILY"),
          content: normalizeOptional(reflection.content),
          sectionsJson: JSON.stringify(sections),
        },
      });
      imported.reflections += 1;
    }

    for (const goal of data.goals || []) {
      if (!goal?.id || !goal?.title) continue;
      await tx.goal.create({
        data: {
          id: goal.id,
          userId,
          title: String(goal.title),
          description: normalizeOptional(goal.description),
          type: pickEnum(goal.type, goalTypes, "DAILY"),
          targetDate: goal.targetDate || goal.dueDate || null,
          weekStartDate: goal.weekStartDate || null,
          weekEndDate: goal.weekEndDate || null,
          month: goal.month || null,
          dueDate: goal.dueDate || goal.targetDate || null,
          progress: Math.min(100, Math.max(0, Number(goal.progress) || 0)),
          completed: !!goal.completed,
        },
      });
      imported.goals += 1;
    }
  });

  return {
    version: data.version ?? "legacy",
    latestVersion: BACKUP_VERSION,
    supportedVersions: SUPPORTED_BACKUP_VERSIONS,
    warnings: data.warnings,
    imported,
  };
};
