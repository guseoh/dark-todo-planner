import type { Goal } from "./goal";
import type { Memo } from "./memo";
import type { MusicLink } from "./music";
import type { Reflection } from "./reflection";
import type { Todo } from "./todo";
import type { Topic, TopicLink } from "./topic";
import type { Category } from "./category";

export type BackupData = {
  version?: number;
  exportedAt?: string;
  categories?: Category[];
  todos?: Todo[];
  reflections?: Reflection[];
  goals?: Goal[];
  memos?: Memo[];
  topics?: Topic[];
  topicLinks?: TopicLink[];
  musicLinks?: MusicLink[];
};
