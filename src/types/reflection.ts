export type ReflectionType = "DAILY" | "WEEKLY" | "MONTHLY";

export type Reflection = {
  id: string;
  date: string;
  type: ReflectionType;
  content: string;
  createdAt: string;
  updatedAt: string;
};
