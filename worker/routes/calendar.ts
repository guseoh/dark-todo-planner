import { Hono } from "hono";
import { buildCalendarIcs, type CalendarTimeBlock, type CalendarTodo } from "../calendarIcs";
import type { Bindings, Variables } from "../types";

export const calendarRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>();

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MAX_RANGE_DAYS = 366;

const dateNumber = (value: string) => {
  if (!DATE_PATTERN.test(value)) return Number.NaN;
  const [year, month, day] = value.split("-").map(Number);
  const date = Date.UTC(year, month - 1, day);
  const parsed = new Date(date);
  if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) return Number.NaN;
  return date;
};

calendarRoutes.get("/calendar/export.ics", async (c) => {
  const from = c.req.query("from") || "";
  const to = c.req.query("to") || "";
  const fromMs = dateNumber(from);
  const toMs = dateNumber(to);
  if (!Number.isFinite(fromMs) || !Number.isFinite(toMs)) {
    return c.json({ message: "내보낼 시작일과 종료일을 YYYY-MM-DD 형식으로 지정해 주세요." }, 400);
  }
  if (toMs < fromMs) return c.json({ message: "종료일은 시작일보다 빠를 수 없습니다." }, 400);
  const rangeDays = Math.floor((toMs - fromMs) / 86_400_000) + 1;
  if (rangeDays > MAX_RANGE_DAYS) return c.json({ message: "Calendar 내보내기는 최대 366일까지 지원합니다." }, 400);

  const userId = c.get("userId");
  const [todoResult, timeBlockResult] = await Promise.all([
    c.env.DB.prepare(`
      SELECT t.id, t.title, t.memo, t.reference_url AS referenceUrl, t.reference_label AS referenceLabel,
             t.date, t.updated_at AS updatedAt, p.name AS projectName, category.name AS categoryName
      FROM todos t
      LEFT JOIN projects p ON p.id = t.project_id
      LEFT JOIN categories category ON category.id = t.category_id
      WHERE t.user_id = ? AND t.archived = 0 AND t.completed = 0
        AND t.planning_state = 'SCHEDULED' AND t.date >= ? AND t.date <= ?
      ORDER BY t.date ASC, t.sort_order ASC, t.created_at ASC
    `).bind(userId, from, to).all<CalendarTodo>(),
    c.env.DB.prepare(`
      SELECT block.id, block.todo_id AS todoId, block.title, block.date,
             block.start_time AS startTime, block.end_time AS endTime, block.updated_at AS updatedAt,
             todo.title AS todoTitle, todo.reference_url AS referenceUrl
      FROM time_blocks block
      LEFT JOIN todos todo ON todo.id = block.todo_id AND todo.user_id = ?
      WHERE block.user_id = ? AND block.date >= ? AND block.date <= ?
      ORDER BY block.date ASC, block.start_time ASC, block.created_at ASC
    `).bind(userId, userId, from, to).all<CalendarTimeBlock>(),
  ]);

  const ics = buildCalendarIcs({ todos: todoResult.results, timeBlocks: timeBlockResult.results });
  return new Response(ics, {
    status: 200,
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      "content-disposition": `attachment; filename="dark-todo-calendar-${from}_${to}.ics"`,
      "cache-control": "no-store",
    },
  });
});
