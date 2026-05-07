export type TopicStatus = "IDEA" | "WRITING" | "DONE";

export type TopicLink = {
  id: string;
  topicId: string;
  title?: string;
  url: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
};

export type Topic = {
  id: string;
  userId?: string;
  title: string;
  memo?: string;
  status: TopicStatus;
  tags: string[];
  links: TopicLink[];
  createdAt: string;
  updatedAt: string;
};

export type TopicInput = {
  title: string;
  memo?: string;
  status?: TopicStatus;
  tags?: string[];
};

export type TopicLinkInput = {
  title?: string;
  url: string;
  description?: string;
};
