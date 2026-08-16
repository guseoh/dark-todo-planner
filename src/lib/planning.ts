import { addDays } from "date-fns";
import { parseDateKey, toDateKey } from "./date";
import type { SavedViewQuery } from "../types/planning";
import type { Todo } from "../types/todo";

export const filterTodosBySavedView = (todos: Todo[], query: SavedViewQuery, today: string) => {
  let result = todos.filter((todo) => !todo.archived);
  if (query.planningState && query.planningState !== "ALL") result = result.filter((todo) => todo.planningState === query.planningState);
  if (query.workflowStatus && query.workflowStatus !== "ALL") result = result.filter((todo) => todo.workflowStatus === query.workflowStatus);
  if (query.priority && query.priority !== "ALL") result = result.filter((todo) => todo.priority === query.priority);
  if (query.projectId && query.projectId !== "ALL") {
    result = query.projectId === "NO_PROJECT"
      ? result.filter((todo) => !todo.projectId)
      : result.filter((todo) => todo.projectId === query.projectId);
  }
  if (query.dueMode === "OVERDUE") result = result.filter((todo) => !todo.completed && Boolean(todo.dueDate) && todo.dueDate! < today);
  if (query.dueMode === "DUE_SOON") {
    const end = toDateKey(addDays(parseDateKey(today), 3));
    result = result.filter((todo) => !todo.completed && Boolean(todo.dueDate) && todo.dueDate! >= today && todo.dueDate! <= end);
  }
  if (query.dueMode === "NO_DUE") result = result.filter((todo) => !todo.dueDate);
  return result.sort((a, b) => {
    if (a.completed !== b.completed) return Number(a.completed) - Number(b.completed);
    if ((a.dueDate || "9999-12-31") !== (b.dueDate || "9999-12-31")) return (a.dueDate || "9999-12-31").localeCompare(b.dueDate || "9999-12-31");
    return a.date.localeCompare(b.date);
  });
};

export const builtInSmartViews: Array<{ id: string; name: string; description: string; query: SavedViewQuery }> = [
  { id: "inbox", name: "Inbox", description: "아직 계획하지 않은 Todo", query: { planningState: "INBOX" } },
  { id: "overdue", name: "마감 초과", description: "마감일이 지난 미완료 Todo", query: { dueMode: "OVERDUE" } },
  { id: "due-soon", name: "3일 내 마감", description: "오늘부터 3일 안에 마감되는 Todo", query: { dueMode: "DUE_SOON" } },
  { id: "waiting", name: "대기 중", description: "외부 응답이나 조건을 기다리는 Todo", query: { planningState: "WAITING" } },
  { id: "someday", name: "Someday", description: "당장은 실행하지 않을 Todo", query: { planningState: "SOMEDAY" } },
  { id: "high", name: "높은 우선순위", description: "높은 우선순위 Todo", query: { priority: "HIGH", workflowStatus: "TODO" } },
  { id: "no-project", name: "프로젝트 없음", description: "아직 프로젝트에 연결되지 않은 Todo", query: { projectId: "NO_PROJECT" } },
];
