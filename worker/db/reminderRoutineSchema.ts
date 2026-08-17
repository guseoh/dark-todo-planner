import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { categories, projects, todos, users } from "./schema";

const timestamps = {
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
};

export const todoReminders = sqliteTable("todo_reminders", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  todoId: text("todo_id").notNull().references(() => todos.id, { onDelete: "cascade" }),
  remindAt: text("remind_at").notNull(),
  channel: text("channel", { enum: ["DISCORD"] }).notNull().default("DISCORD"),
  status: text("status", { enum: ["PENDING", "SENT", "CANCELLED"] }).notNull().default("PENDING"),
  sentAt: text("sent_at"),
  claimToken: text("claim_token"),
  claimedAt: text("claimed_at"),
  ...timestamps,
}, (table) => [
  uniqueIndex("todo_reminders_todo_uidx").on(table.todoId),
  index("todo_reminders_user_status_remind_idx").on(table.userId, table.status, table.remindAt),
]);

export const routineTemplates = sqliteTable("routine_templates", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  ...timestamps,
}, (table) => [index("routine_templates_user_updated_idx").on(table.userId, table.updatedAt)]);

export const routineTemplateItems = sqliteTable("routine_template_items", {
  id: text("id").primaryKey(),
  routineId: text("routine_id").notNull().references(() => routineTemplates.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  priority: text("priority", { enum: ["LOW", "MEDIUM", "HIGH"] }).notNull().default("MEDIUM"),
  estimateMinutes: integer("estimate_minutes"),
  projectId: text("project_id").references(() => projects.id, { onDelete: "set null" }),
  categoryId: text("category_id").references(() => categories.id, { onDelete: "set null" }),
  order: integer("sort_order").notNull().default(0),
  ...timestamps,
}, (table) => [index("routine_template_items_routine_order_idx").on(table.routineId, table.order)]);

export const routineRuns = sqliteTable("routine_runs", {
  id: text("id").primaryKey(),
  routineId: text("routine_id").notNull().references(() => routineTemplates.id, { onDelete: "cascade" }),
  targetDate: text("target_date").notNull(),
  createdAt: text("created_at").notNull(),
}, (table) => [uniqueIndex("routine_runs_routine_date_uidx").on(table.routineId, table.targetDate)]);
