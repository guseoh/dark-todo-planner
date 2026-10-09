import type { TodoPlanningState, TodoWorkflowStatus } from "../types/todo";

export const planningStateLabels: Record<TodoPlanningState, string> = {
  INBOX: "받은함",
  SCHEDULED: "일정",
  SOMEDAY: "언젠가",
  WAITING: "대기",
};

export const workflowStatusLabels: Record<TodoWorkflowStatus, string> = {
  TODO: "할 일",
  IN_PROGRESS: "진행 중",
  BLOCKED: "차단됨",
  DONE: "완료",
};

export const workflowStatusClassNames: Record<TodoWorkflowStatus, string> = {
  TODO: "border-ink-700 bg-ink-800/50 text-ink-300",
  IN_PROGRESS: "border-accent-300/35 bg-accent-500/15 text-accent-200",
  BLOCKED: "border-danger/35 bg-danger/10 text-danger",
  DONE: "border-success/35 bg-success/10 text-success",
};
