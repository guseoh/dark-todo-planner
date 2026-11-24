import { describe, expect, it } from "vitest";
import type { Category } from "../types/category";
import type { TimeEntry } from "../types/timeTracking";
import { clockLabel, formatClock, formatDuration, formatShortDuration, isTargetRunning, hourlyBuckets, intervalOnDay, totalsByCategory, measuredTotals, totalMs } from "./timeTracking";

const at = (date: string, time: string) => new Date(`${date}T${time}`).toISOString();
const category = (id: string, name: string, color: string): Category => ({
  id, userId: "u", name, color, order: 0, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z",
});
const entry = (id: string, start: string, end: string, categoryId?: string): TimeEntry => ({
  id, title: id, categoryId, plannerDate: "", startedAt: start, endedAt: end, durationMinutes: 0,
});
const java = category("java", "자바 학습", "#3366ff");

describe("formatting", () => {
  it("formats a running clock without padding hours", () => {
    expect(formatClock(450_000)).toBe("0:07:30");
    expect(formatClock(3_909_000)).toBe("1:05:09");
    expect(formatClock(-5)).toBe("0:00:00");
  });
  it("formats readable durations", () => {
    expect(formatDuration(45 * 60_000)).toBe("45분");
    expect(formatDuration(125 * 60_000)).toBe("2시간 5분");
    expect(formatDuration(120 * 60_000)).toBe("2시간");
  });
  it("matches the running timer to its todo, category or project target", () => {
    const todo = { todoId: "t1", todoTitle: "x", categoryId: "c1", startedAt: "2026-01-01T00:00:00Z" };
    const category = { todoTitle: "Java", categoryId: "c1", startedAt: "2026-01-01T00:00:00Z" };
    const project = { todoTitle: "Devpedia", projectId: "p1", categoryId: "c1", startedAt: "2026-01-01T00:00:00Z" };
    expect(isTargetRunning(todo, { todoId: "t1" })).toBe(true);
    expect(isTargetRunning(todo, { categoryId: "c1" })).toBe(false);
    expect(isTargetRunning(category, { categoryId: "c1" })).toBe(true);
    expect(isTargetRunning(category, { projectId: "p1" })).toBe(false);
    expect(isTargetRunning(project, { projectId: "p1" })).toBe(true);
    expect(isTargetRunning(project, { categoryId: "c1" })).toBe(false);
    expect(isTargetRunning(null, { categoryId: "c1" })).toBe(false);
  });

  it("formats compact durations for calendar cells", () => {
    expect(formatShortDuration(45 * 60_000)).toBe("45m");
    expect(formatShortDuration(90 * 60_000)).toBe("1h 30m");
    expect(formatShortDuration(120 * 60_000)).toBe("2h");
  });
  it("labels minutes from the 03:00 planner-day start", () => {
    expect(clockLabel(0)).toBe("03:00");
    expect(clockLabel(21 * 60)).toBe("00:00");
    expect(clockLabel(23 * 60 + 30)).toBe("02:30");
  });
});

describe("planner-day intervals", () => {
  it("places a morning session by its offset from 03:00", () => {
    expect(intervalOnDay(at("2026-11-16", "09:00:00"), at("2026-11-16", "10:30:00"), "2026-11-16")).toEqual({ start: 360, end: 450 });
  });
  it("clips a session that runs past 03:00 to each planner day", () => {
    const start = at("2026-11-16", "23:00:00");
    const end = at("2026-11-17", "04:00:00");
    expect(intervalOnDay(start, end, "2026-11-16")).toEqual({ start: 20 * 60, end: 24 * 60 });
    expect(intervalOnDay(start, end, "2026-11-17")).toEqual({ start: 0, end: 60 });
  });
  it("ignores sessions on other days", () => {
    expect(intervalOnDay(at("2026-11-15", "09:00:00"), at("2026-11-15", "10:00:00"), "2026-11-16")).toBeNull();
  });
});

describe("aggregation", () => {
  const entries = [
    entry("a", at("2026-11-16", "09:00:00"), at("2026-11-16", "10:00:00"), "java"),
    entry("b", at("2026-11-16", "10:30:00"), at("2026-11-16", "11:00:00"), "java"),
    entry("c", at("2026-11-16", "14:00:00"), at("2026-11-16", "14:20:00")),
  ];
  it("sums per category, largest first, with an uncategorized bucket", () => {
    const totals = totalsByCategory(entries, ["2026-11-16"], [java]);
    expect(totals.map((t) => [t.name, t.ms / 60_000])).toEqual([["자바 학습", 90], ["미분류", 20]]);
  });
  it("keeps the snapshot name when the category was deleted", () => {
    const totals = totalsByCategory([{ ...entries[0], categoryName: "옛 카테고리" }], ["2026-11-16"], []);
    expect(totals[0].name).toBe("옛 카테고리");
  });
  it("splits a session across hourly buckets", () => {
    const cells = hourlyBuckets([entry("x", at("2026-11-16", "09:30:00"), at("2026-11-16", "10:15:00"), "java")], "2026-11-16", [java]);
    const nine = cells[6]; const ten = cells[7];
    expect(nine.label).toBe("09:00");
    expect(nine.segments[0].ms / 60_000).toBe(30);
    expect(ten.segments[0].ms / 60_000).toBe(15);
    expect(cells[8].segments).toHaveLength(0);
  });
});

describe("measured totals by dimension", () => {
  const first = { ...entry("a", at("2026-11-16", "23:00:00"), at("2026-11-17", "04:00:00"), "java"), todoId: "t1", projectId: "p1", title: "기록한 작업" };
  const second = entry("b", at("2026-11-17", "09:00:00"), at("2026-11-17", "10:00:00"));
  it("preserves the same total in every dimension, including unassigned entries and duplicate dates/IDs", () => {
    for (const dimension of ["category", "project", "todo"] as const) {
      const totals = measuredTotals([first, first, second], ["2026-11-16", "2026-11-17", "2026-11-17"], dimension, [java], [], []);
      expect(totalMs(totals)).toBe(6 * 60 * 60_000);
      expect(totals).toHaveLength(2);
    }
  });
  it("uses recorded identifiers and snapshot title for missing entities", () => {
    expect(measuredTotals([first], ["2026-11-17"], "todo", [], [], [])[0]).toMatchObject({ key: "todo:t1", name: "기록한 작업", ms: 60 * 60_000 });
    expect(measuredTotals([first], ["2026-11-17"], "project", [], [], [])[0]).toMatchObject({ key: "project:p1", name: "삭제된 프로젝트", ms: 60 * 60_000 });
  });
});
