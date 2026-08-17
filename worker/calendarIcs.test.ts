import { describe, expect, it } from "vitest";
import { buildCalendarIcs } from "./calendarIcs";

describe("buildCalendarIcs", () => {
  it("exports linked time blocks as timed events and avoids duplicate all-day Todo events", () => {
    const ics = buildCalendarIcs({
      generatedAt: new Date("2026-08-17T10:00:00.000Z"),
      todos: [
        { id: "todo-linked", title: "연결 Todo", date: "2026-08-18", updatedAt: "2026-08-17T09:00:00.000Z" },
        { id: "todo-day", title: "문서 정리", memo: "1차 확인\n2차 확인", date: "2026-08-19", updatedAt: "2026-08-17T09:30:00.000Z", projectName: "개인", categoryName: "정리" },
      ],
      timeBlocks: [
        { id: "block-1", todoId: "todo-linked", title: "집중 작업", date: "2026-08-18", startTime: "09:30", endTime: "11:00", updatedAt: "2026-08-17T09:20:00.000Z", todoTitle: "연결 Todo" },
      ],
    });

    expect(ics).toContain("UID:time-block-block-1@dark-todo-planner");
    expect(ics).toContain("DTSTART;TZID=Asia/Seoul:20260818T093000");
    expect(ics).toContain("DTEND;TZID=Asia/Seoul:20260818T110000");
    expect(ics).not.toContain("UID:todo-todo-linked@dark-todo-planner");
    expect(ics).toContain("UID:todo-todo-day@dark-todo-planner");
    expect(ics).toContain("DTSTART;VALUE=DATE:20260819");
    expect(ics).toContain("DTEND;VALUE=DATE:20260820");
    expect(ics).toContain("DESCRIPTION:1차 확인\\n2차 확인\\n프로젝트: 개인\\n카테고리: 정리");
    expect(ics.endsWith("\r\n")).toBe(true);
  });

  it("escapes text and folds physical lines to at most 75 UTF-8 bytes", () => {
    const longTitle = `백엔드, 캘린더; 내보내기 \\ ${"한글일정".repeat(18)}`;
    const ics = buildCalendarIcs({
      generatedAt: new Date("2026-08-17T10:00:00.000Z"),
      todos: [{ id: "todo-long", title: longTitle, date: "2026-08-20", updatedAt: "2026-08-17T09:00:00.000Z" }],
      timeBlocks: [],
    });

    expect(ics).toContain("SUMMARY:백엔드\\, 캘린더\\; 내보내기 \\\\");
    const encoder = new TextEncoder();
    for (const line of ics.split("\r\n").filter(Boolean)) {
      expect(encoder.encode(line).length).toBeLessThanOrEqual(75);
    }
  });
});
