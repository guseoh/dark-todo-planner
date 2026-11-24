import { todayKey } from "../date";
import type { Todo } from "../../types/todo";
import type { Category } from "../../types/category";
import type { Project } from "../../types/project";
import type { Memo } from "../../types/memo";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const stamp = new Date().toISOString();
const day = todayKey();
const categories: Category[] = [{ id: "qa-study", userId: "qa", name: "Study", color: "#79a7f7", order: 0, createdAt: stamp, updatedAt: stamp }];
const projects: Project[] = [{ id: "qa-project", name: "QA 프로젝트", status: "ACTIVE", archived: false, order: 0, createdAt: stamp, updatedAt: stamp }];
const todos: Todo[] = [
  { id: "qa-todo-1", title: "디자인 검증", categoryId: "qa-study", projectId: "qa-project", category: categories[0], date: day, planningState: "SCHEDULED", workflowStatus: "TODO", priority: "HIGH", completed: false, archived: false, createdAt: stamp, updatedAt: stamp, order: 0 },
  { id: "qa-todo-2", title: "프로젝트 상태 확인", projectId: "qa-project", date: day, planningState: "SCHEDULED", workflowStatus: "IN_PROGRESS", priority: "MEDIUM", completed: false, archived: false, createdAt: stamp, updatedAt: stamp, order: 1 },
];
const memos: Memo[] = [{ id: "qa-memo", title: "QA 예시 메모", content: "# 화면 검증\n\n- 탭 이동\n- 편집기 확인", pinned: false, todoIds: [], projectIds: ["qa-project"], createdAt: stamp, updatedAt: stamp }];
let scratchpad = { content: "# QA 낙서장\n\n운영 데이터가 아닌 예시 문서입니다.", updatedAt: stamp };

/** Build-time QA only. Fail closed: never fall through to a real API, even for unknown routes. */
export const qaFetch: typeof fetch = async (input, init) => {
  if (init?.signal?.aborted) throw new DOMException("요청이 취소되었습니다.", "AbortError");
  if (typeof input !== "string" || !input.startsWith("/api/")) return json({ message: "QA 모드에서는 외부 요청을 허용하지 않습니다." }, 403);
  const url = new URL(input, "https://qa.invalid");
  if (url.origin !== "https://qa.invalid" || !url.pathname.startsWith("/api/")) return json({ message: "허용되지 않은 QA 경로" }, 403);
  const method = (init?.method ?? "GET").toUpperCase();
  if (method === "POST" && url.pathname === "/api/planner-automations/run") return json({ automation: { plannerDate: todayKey(), carriedOver: 0, autoArchived: 0 } });
  if (method === "PUT" && url.pathname === "/api/scratchpad") {
    try {
      const body = JSON.parse(String(init?.body ?? "{}"));
      if (typeof body.content !== "string") return json({ message: "잘못된 예시 문서" }, 400);
      scratchpad = { content: body.content, updatedAt: new Date().toISOString() };
      return json({ scratchpad });
    } catch { return json({ message: "잘못된 요청" }, 400); }
  }
  if (method !== "GET") return json({ message: "현재 QA 시안 빌드는 일부 수정만 지원합니다. 운영 데이터로 전송되지 않습니다." }, 501);
  const responses: Record<string, unknown> = {
    "/api/auth/session": { authenticated: true, username: "QA fixture" },
    "/api/bootstrap": { data: {} },
    "/api/categories": { categories },
    "/api/todos": { todos },
    "/api/projects": { projects },
    "/api/memos": { memos },
    "/api/milestones": { milestones: [] },
    "/api/project-decisions": { decisions: [] },
    "/api/goals": { goals: [] },
    "/api/routines": { routines: [] },
    "/api/planner-settings": { plannerSettings: { carryOverEnabled: false, autoArchiveCompleted: false, reminderTodayEnabled: false, reminderOverdueEnabled: false, reminderDueSoonEnabled: false, reminderDueSoonDays: 3, dailyGoalMinutes: 0, wipLimits: {} } },
    "/api/timer": { activeTimer: null, serverNow: new Date().toISOString() },
    "/api/time-entries": { timeEntries: [] },
    "/api/time-summary": { byProject: [] },
    "/api/time-blocks": { timeBlocks: [] },
    "/api/daily-plans": { dailyPlans: [] },
    "/api/reflections": { reflections: [] },
    "/api/trash/todos": { trashTodos: [] },
    "/api/scratchpad": { scratchpad },
  };
  if (!Object.prototype.hasOwnProperty.call(responses, url.pathname)) return json({ message: "아직 지원하지 않는 QA 조회입니다." }, 501);
  return json(responses[url.pathname]);
};
