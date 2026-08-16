import { describe, expect, it } from "vitest";
import { buildInsightsSnapshot, formatInsightMinutes } from "./insights";
import type { Project } from "../types/project";
import type { FocusSession, TimeBlock } from "../types/time";
import type { Todo } from "../types/todo";

const todo = (overrides: Partial<Todo> = {}): Todo => ({
  id: "todo-1",
  title: "Todo",
  date: "2026-08-16",
  planningState: "SCHEDULED",
  workflowStatus: "TODO",
  priority: "MEDIUM",
  completed: false,
  createdAt: "2026-08-16T00:00:00.000Z",
  updatedAt: "2026-08-16T00:00:00.000Z",
  repeat: "NONE",
  tags: [],
  archived: false,
  ...overrides,
});

const project = (overrides: Partial<Project> = {}): Project => ({
  id: "project-1",
  name: "프로젝트",
  status: "ACTIVE",
  archived: false,
  order: 0,
  createdAt: "2026-08-01T00:00:00.000Z",
  updatedAt: "2026-08-01T00:00:00.000Z",
  ...overrides,
});

const focus = (overrides: Partial<FocusSession> = {}): FocusSession => ({
  id: "focus-1",
  mode: "FOCUS",
  durationMinutes: 25,
  plannerDate: "2026-08-16",
  startedAt: "2026-08-16T01:00:00.000Z",
  endedAt: "2026-08-16T01:25:00.000Z",
  completed: true,
  createdAt: "2026-08-16T01:25:00.000Z",
  ...overrides,
});

const block = (overrides: Partial<TimeBlock> = {}): TimeBlock => ({
  id: "block-1",
  title: "집중",
  date: "2026-08-16",
  startTime: "10:00",
  endTime: "11:00",
  plannedMinutes: 60,
  completed: true,
  createdAt: "2026-08-16T00:00:00.000Z",
  updatedAt: "2026-08-16T00:00:00.000Z",
  ...overrides,
});

describe("buildInsightsSnapshot", () => {
  it("calculates scheduled Todo completion and current overdue counts separately", () => {
    const snapshot = buildInsightsSnapshot({
      todos: [
        todo({ id: "done", completed: true, workflowStatus: "DONE", estimateMinutes: 30 }),
        todo({ id: "open", estimateMinutes: 45 }),
        todo({ id: "overdue", date: "2026-08-08" }),
        todo({ id: "future", date: "2026-08-20" }),
      ],
      projects: [],
      focusSessions: [],
      timeBlocks: [],
      from: "2026-08-10",
      to: "2026-08-16",
      today: "2026-08-16",
    });

    expect(snapshot.periodTodoTotal).toBe(2);
    expect(snapshot.periodTodoCompleted).toBe(1);
    expect(snapshot.completionRate).toBe(50);
    expect(snapshot.overdueTotal).toBe(1);
    expect(snapshot.estimatedMinutes).toBe(75);
  });

  it("counts only completed focus sessions and compares them with planned blocks", () => {
    const snapshot = buildInsightsSnapshot({
      todos: [],
      projects: [],
      focusSessions: [focus(), focus({ id: "break", mode: "SHORT_BREAK", durationMinutes: 5 }), focus({ id: "aborted", completed: false, durationMinutes: 50 })],
      timeBlocks: [block(), block({ id: "block-2", plannedMinutes: 30, completed: false })],
      from: "2026-08-10",
      to: "2026-08-16",
      today: "2026-08-16",
    });

    expect(snapshot.focusMinutes).toBe(25);
    expect(snapshot.focusSessionCount).toBe(1);
    expect(snapshot.plannedMinutes).toBe(90);
    expect(snapshot.focusVsPlanRate).toBe(28);
  });

  it("summarizes active project progress from linked Todos", () => {
    const snapshot = buildInsightsSnapshot({
      todos: [
        todo({ id: "p1-done", projectId: "project-1", completed: true, workflowStatus: "DONE" }),
        todo({ id: "p1-open", projectId: "project-1", date: "2026-08-10", estimateMinutes: 40 }),
      ],
      projects: [project()],
      focusSessions: [],
      timeBlocks: [],
      from: "2026-08-10",
      to: "2026-08-16",
      today: "2026-08-16",
    });

    expect(snapshot.projects[0]).toMatchObject({ total: 2, completed: 1, completionRate: 50, overdue: 1, remainingEstimateMinutes: 40 });
  });
});

describe("formatInsightMinutes", () => {
  it("uses compact Korean hour and minute labels", () => {
    expect(formatInsightMinutes(45)).toBe("45분");
    expect(formatInsightMinutes(120)).toBe("2시간");
    expect(formatInsightMinutes(135)).toBe("2시간 15분");
  });
});
