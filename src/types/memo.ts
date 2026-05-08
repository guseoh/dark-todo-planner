export type Memo = {
  id: string;
  userId?: string;
  title?: string;
  content: string;
  color?: string;
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
};

export type MemoInput = {
  title?: string;
  content: string;
  color?: string;
  pinned?: boolean;
};
