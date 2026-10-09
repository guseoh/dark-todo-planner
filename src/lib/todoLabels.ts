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
