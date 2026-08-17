export type LearningItemType = "DAILY_PROBLEM" | "TECH_BLOG";
export type LearningItemStatus = "UNREAD" | "READING" | "DONE" | "SKIPPED";

export type LearningItem = {
  id: string;
  userId?: string;
  learningDate: string;
  type: LearningItemType;
  title: string;
  summary?: string;
  sourceUrl?: string;
  sourceName?: string;
  categories?: string[];
  status: LearningItemStatus;
  externalKey: string;
  todoId?: string;
  createdAt: string;
  updatedAt: string;
};

export type LearningImportInput = {
  learningDate: string;
  type: LearningItemType;
  title: string;
  summary?: string;
  sourceUrl?: string;
  sourceName?: string;
  categories?: string[];
  externalKey: string;
};
