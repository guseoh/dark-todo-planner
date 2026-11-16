import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { todos, users } from "./schema";

export const focusSessionsV2 = sqliteTable("focus_sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  todoId: text("todo_id").references(() => todos.id, { onDelete: "set null" }),
  todoTitle: text("todo_title"),
  mode: text("mode", { enum: ["FOCUS", "SHORT_BREAK", "LONG_BREAK"] }).notNull(),
  durationMinutes: integer("duration_minutes").notNull(),
  plannerDate: text("planner_date").notNull(),
  startedAt: text("started_at").notNull(),
  endedAt: text("ended_at").notNull(),
  completed: integer("completed", { mode: "boolean" }).notNull().default(true),
  // Time tracking snapshots: sessions keep their category after the Todo or category is deleted.
  categoryId: text("category_id"),
  categoryName: text("category_name"),
  projectId: text("project_id"),
  createdAt: text("created_at").notNull(),
}, (table) => [
  index("focus_sessions_user_planner_date_idx").on(table.userId, table.plannerDate),
  index("focus_sessions_todo_v2_idx").on(table.todoId),
]);

export const timeBlocks = sqliteTable("time_blocks", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  todoId: text("todo_id").references(() => todos.id, { onDelete: "set null" }),
  title: text("title").notNull(),
  date: text("date").notNull(),
  startTime: text("start_time").notNull(),
  endTime: text("end_time").notNull(),
  plannedMinutes: integer("planned_minutes").notNull(),
  completed: integer("completed", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [
  index("time_blocks_user_date_start_idx").on(table.userId, table.date, table.startTime),
  index("time_blocks_todo_idx").on(table.todoId),
]);

/** The single running timer per user; finished work is stored as focus_sessions rows. */
export const activeTimers = sqliteTable("active_timers", {
  userId: text("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  todoId: text("todo_id").references(() => todos.id, { onDelete: "set null" }),
  todoTitle: text("todo_title").notNull(),
  categoryId: text("category_id"),
  categoryName: text("category_name"),
  projectId: text("project_id"),
  startedAt: text("started_at").notNull(),
});
