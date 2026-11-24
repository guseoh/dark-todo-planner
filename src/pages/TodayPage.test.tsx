import { beforeAll, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { Todo } from "../types/todo";
import { TodayPage } from "./TodayPage";

const overdue: Todo = {
  id: "late", title: "지난 작업", date: "2020-01-02", planningState: "SCHEDULED", workflowStatus: "TODO",
  priority: "MEDIUM", completed: false, archived: false,
  createdAt: "2020-01-01T00:00:00.000Z", updatedAt: "2020-01-01T00:00:00.000Z",
};
const noop = () => undefined;
const props = {
  todayTodos: [], candidateTodos: [], overdueTodos: [overdue],
  rail: { todos: [], goals: [], dueSoonDays: 3, onAddGoal: noop, onUpdateGoal: noop, onToggleGoal: noop, onDeleteGoal: noop, onReload: async () => undefined },
  onMoveOverdue: async () => true, onPlanTodoToToday: async () => true,
  stats: { todayTotal: 0, todayCompleted: 0, todayActive: 0, todayRate: 0, weekTotal: 0, weekRate: 0 },
  onAdd: noop, onToggle: noop, onDelete: noop, onDeleteMany: () => true, onUpdate: noop, onReorderTodos: async () => true,
  onAddCategory: noop, onUpdateCategory: noop, onDeleteCategory: noop, onReorderCategories: noop,
  onBringOverdueTodos: async () => ({ total: 1, success: 1, skipped: 0, failed: 0, mode: "move" as const }),
} as unknown as Parameters<typeof TodayPage>[0];

describe("Today page overdue work", () => {
  beforeAll(() => {
    const store = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => store.get(key) ?? null, setItem: (key: string, value: string) => void store.set(key, value),
      removeItem: (key: string) => void store.delete(key), clear: () => store.clear(), key: () => null, length: 0,
    });
  });

  it("surfaces unfinished past-dated work instead of hiding it", () => {
    const html = renderToStaticMarkup(<TodayPage {...props} />);
    expect(html).toContain("today-overdue-notice");
    expect(html).toContain("1개</strong>가 아직 끝나지 않았습니다");
    expect(html).toContain("오늘 계획하기, 지난 일정 1개");
  });

  it("shows nothing extra when there is no overdue work", () => {
    const html = renderToStaticMarkup(<TodayPage {...props} overdueTodos={[]} />);
    expect(html).not.toContain("today-overdue-notice");
  });
});
