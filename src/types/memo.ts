export type Memo = {
  id: string;
  userId?: string;
  title?: string;
  content: string;
  color?: string;
  pinned: boolean;
  todoIds: string[];
  projectIds: string[];
  createdAt: string;
  updatedAt: string;
};

export type MemoInput = {
  title?: string;
  content: string;
  color?: string;
  pinned?: boolean;
};

export type MemoLinksInput = {
  todoIds: string[];
  projectIds: string[];
};
