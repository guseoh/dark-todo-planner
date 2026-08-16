import type { Goal } from "../types/goal";
import type { Memo } from "../types/memo";
import type { Project } from "../types/project";
import type { Todo } from "../types/todo";

const csvCell = (value: unknown) => {
  const text = value == null ? "" : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

export const buildTodoCsv = (todos: Todo[], projects: Project[]) => {
  const projectMap = new Map(projects.map((project) => [project.id, project.name]));
  const header = ["id", "title", "memo", "date", "dueDate", "priority", "planningState", "workflowStatus", "completed", "archived", "project", "category", "estimateMinutes", "repeat", "tags"];
  const rows = todos.map((todo) => [
    todo.id,
    todo.title,
    todo.memo || "",
    todo.date,
    todo.dueDate || "",
    todo.priority,
    todo.planningState,
    todo.workflowStatus,
    todo.completed,
    todo.archived,
    todo.projectId ? projectMap.get(todo.projectId) || todo.projectId : "",
    todo.category?.name || "",
    todo.estimateMinutes || "",
    todo.repeat,
    (todo.tags || []).join(" "),
  ]);
  return [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");
};

const checkbox = (todo: Todo) => `- [${todo.completed ? "x" : " "}] ${todo.title}`;
const todoDetail = (todo: Todo) => {
  const bits = [`실행 ${todo.date}`];
  if (todo.dueDate) bits.push(`마감 ${todo.dueDate}`);
  bits.push(todo.priority, todo.planningState);
  if (todo.estimateMinutes) bits.push(`예상 ${todo.estimateMinutes}분`);
  return `${checkbox(todo)} — ${bits.join(" · ")}`;
};

export const buildPlannerMarkdown = ({
  todos,
  projects,
  goals,
  memos,
  exportedAt = new Date().toISOString(),
}: {
  todos: Todo[];
  projects: Project[];
  goals: Goal[];
  memos: Memo[];
  exportedAt?: string;
}) => {
  const lines: string[] = ["# Dark Todo Planner Export", "", `- Exported: ${exportedAt}`, `- Todo: ${todos.length}`, `- Project: ${projects.length}`, `- Goal: ${goals.length}`, `- Memo: ${memos.length}`, ""];
  const activeTodos = todos.filter((todo) => !todo.archived);
  const projectMap = new Map(projects.map((project) => [project.id, project]));

  lines.push("## Projects", "");
  for (const project of projects) {
    const projectTodos = activeTodos.filter((todo) => todo.projectId === project.id);
    lines.push(`### ${project.name}${project.archived ? " (archived)" : ""}`, "");
    if (project.description) lines.push(project.description, "");
    if (project.resources?.length) {
      lines.push("자료", ...project.resources.map((resource) => `- [${resource.label}](${resource.url})`), "");
    }
    if (projectTodos.length) lines.push(...projectTodos.map(todoDetail), "");
    else lines.push("- Todo 없음", "");
  }

  const unprojected = activeTodos.filter((todo) => !todo.projectId || !projectMap.has(todo.projectId));
  lines.push("## Todo without Project", "", ...(unprojected.length ? unprojected.map(todoDetail) : ["- 없음"]), "");

  const planningGroups = ["INBOX", "WAITING", "SOMEDAY"] as const;
  lines.push("## Planning Queues", "");
  for (const state of planningGroups) {
    const items = activeTodos.filter((todo) => todo.planningState === state);
    lines.push(`### ${state}`, "", ...(items.length ? items.map(todoDetail) : ["- 없음"]), "");
  }

  lines.push("## Goals", "");
  if (goals.length) lines.push(...goals.map((goal) => `- [${goal.completed ? "x" : " "}] ${goal.title}${goal.dueDate ? ` — 마감 ${goal.dueDate}` : ""}`), "");
  else lines.push("- 없음", "");

  lines.push("## Memos", "");
  if (memos.length) {
    for (const memo of memos) {
      const title = memo.title?.trim() || memo.content.split("\n").find((line) => line.trim())?.trim() || "제목 없는 메모";
      lines.push(`### ${title}`, "", memo.content, "");
    }
  } else lines.push("- 없음", "");

  return lines.join("\n").trimEnd() + "\n";
};

export const downloadText = (filename: string, content: string, type: string) => {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
};
