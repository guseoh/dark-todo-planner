export type ProjectStatus = "PLANNING" | "ACTIVE" | "ON_HOLD" | "DONE";
export type MilestoneStatus = "TODO" | "IN_PROGRESS" | "DONE";

export type Project = {
  id: string;
  userId?: string;
  name: string;
  description?: string;
  status: ProjectStatus;
  color?: string;
  icon?: string;
  startDate?: string;
  targetDate?: string;
  archived: boolean;
  archivedAt?: string;
  order: number;
  createdAt: string;
  updatedAt: string;
};

export type ProjectInput = {
  name: string;
  description?: string;
  status?: ProjectStatus;
  color?: string;
  icon?: string;
  startDate?: string;
  targetDate?: string;
  archived?: boolean;
  order?: number;
};

export type Milestone = {
  id: string;
  userId?: string;
  projectId: string;
  title: string;
  description?: string;
  targetDate?: string;
  status: MilestoneStatus;
  order: number;
  createdAt: string;
  updatedAt: string;
};

export type MilestoneInput = {
  projectId: string;
  title: string;
  description?: string;
  targetDate?: string;
  status?: MilestoneStatus;
  order?: number;
};
