export const BACKUP_VERSION = 6;

export const SUPPORTED_BACKUP_VERSIONS = [1, 2, 3, 4, 5, 6] as const;

export const BACKUP_COLLECTION_KEYS = [
  "categories",
  "todos",
  "reflections",
  "goals",
  "memos",
  "topics",
  "topicLinks",
  "musicLinks",
] as const;

export type BackupCollectionKey = (typeof BACKUP_COLLECTION_KEYS)[number];
