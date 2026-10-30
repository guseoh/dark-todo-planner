import { describe, expect, it } from "vitest";
import { buildCalendarEvents, defaultCalendarVisibility, groupCalendarEvents } from "./calendarEvents";
import type { Todo } from "../types/todo";
import type { Project, Milestone } from "../types/project";

const todo = (partial: Partial<Todo> = {}): Todo => ({
  id: "t1",
  title: "설계 문서 정리",
  date: "2026-10-12",
  planningState: "SCHEDULED",
  workflowStatus: "TODO",
  priority: "MEDIUM",
  completed: false,
  archived: false,
  createdAt: "2026-10-01T00:00:00Z",
  updatedAt: "2026-10-01T00:00:00Z",
  ...partial,
});
const project = (partial: Partial<Project> = {}): Project => ({
  id: "p1", name: "프로젝트 A", status: "ACTIVE", archived: false,
  targetDate: "2026-10-24", order: 0,
  createdAt: "2026-10-01T00:00:00Z", updatedAt: "2026-10-01T00:00:00Z",
  ...partial,
});
const milestone = (partial: Partial<Milestone> = {}): Milestone => ({
  id: "m1", projectId: "p1", title: "1차 출시", targetDate: "2026-10-22",
  status: "TODO", order: 0,
  createdAt: "2026-10-01T00:00:00Z", updatedAt: "2026-10-01T00:00:00Z",
  ...partial,
});

describe("calendar events", () => {
  it("renders a scheduled Todo once when execution and deadline dates match", () => {
    const items = buildCalendarEvents([todo({ dueDate: "2026-10-12" })], [], []);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ date: "2026-10-12", kind: "todo", title: "설계 문서 정리" });
  });

  it("separates Todo execution dates from their actual due dates", () => {
    const items = buildCalendarEvents([todo({ dueDate: "2026-10-19" })], [], []);
    expect(items.map((item) => [item.kind, item.date])).toEqual([
      ["todo", "2026-10-12"], ["deadline", "2026-10-19"],
    ]);
    expect(items[1].relatedTodoId).toBe("t1");
  });

  it("does not display unscheduled or archived Todo occurrences", () => {
    const items = buildCalendarEvents([
      todo({ id: "inbox", planningState: "INBOX", date: "9999-12-31", dueDate: "2026-10-17" }),
      todo({ id: "archived", archived: true, dueDate: "2026-10-13" }),
      todo({ id: "someday", planningState: "SOMEDAY" }),
    ], [], []);
    expect(items.map((item) => item.id)).toEqual(["deadline:inbox"]);
  });

  it("renders project milestones and target dates but excludes archived projects", () => {
    const items = buildCalendarEvents([], [
      project(), project({ id: "archived", archived: true, targetDate: "2026-10-20" }),
    ], [
      milestone(), milestone({ id: "orphan", projectId: "archived", targetDate: "2026-10-21" }),
    ]);
    expect(items.map((item) => [item.kind, item.date, item.projectName])).toEqual([
      ["milestone", "2026-10-22", "프로젝트 A"],
      ["project", "2026-10-24", "프로젝트 A"],
    ]);
  });

  it("preserves same-day multi-item ordering and category filter visibility", () => {
    const items = buildCalendarEvents([
      todo({ id: "a", title: "A", completed: true }),
      todo({ id: "b", title: "B" }),
    ], [project({ targetDate: "2026-10-12" })], [milestone({ targetDate: "2026-10-12" })]);
    const all = groupCalendarEvents(items, defaultCalendarVisibility).get("2026-10-12") ?? [];
    expect(all.map((event) => event.kind)).toEqual(["todo", "milestone", "project", "todo"]);
    expect(all[0].title).toBe("B");
    expect(groupCalendarEvents(items, { todo: false, deadline: true, project: true }).get("2026-10-12")?.map((event) => event.kind))
      .toEqual(["milestone", "project"]);
    expect(groupCalendarEvents(items, { todo: false, deadline: false, project: false }).size).toBe(0);
  });

  it("tracks completion status independently across event types", () => {
    const items = buildCalendarEvents([todo({ completed: true, dueDate: "2026-10-20" })], [
      project({ status: "DONE" }),
    ], [milestone({ status: "DONE" })]);
    expect(items).toHaveLength(4);
    expect(items.every((item) => item.completed)).toBe(true);
  });
});
