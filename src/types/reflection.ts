export type ReflectionType = "DAILY" | "WEEKLY" | "MONTHLY";

export type ReflectionSection = {
  id: string;
  title: string;
  content: string;
  order: number;
};

export type Reflection = {
  id: string;
  userId?: string;
  date: string;
  type: ReflectionType;
  content?: string;
  sections: ReflectionSection[];
  createdAt: string;
  updatedAt: string;
};
