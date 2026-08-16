import { index, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { users } from "./schema";

const timestamps = {
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
};

export const dailyPlans = sqliteTable("daily_plans", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  date: text("date").notNull(),
  focusText: text("focus_text"),
  topTodoIdsJson: text("top_todo_ids_json").notNull().default("[]"),
  ...timestamps,
}, (table) => [uniqueIndex("daily_plans_user_date_uidx").on(table.userId, table.date)]);

export const weeklyReviews = sqliteTable("weekly_reviews", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  weekStartDate: text("week_start_date").notNull(),
  wins: text("wins"),
  blockers: text("blockers"),
  lessons: text("lessons"),
  nextFocus: text("next_focus"),
  ...timestamps,
}, (table) => [uniqueIndex("weekly_reviews_user_week_uidx").on(table.userId, table.weekStartDate)]);

export const savedViews = sqliteTable("saved_views", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  queryJson: text("query_json").notNull().default("{}"),
  ...timestamps,
}, (table) => [
  uniqueIndex("saved_views_user_name_uidx").on(table.userId, table.name),
  index("saved_views_user_updated_idx").on(table.userId, table.updatedAt),
]);

export const taskTemplates = sqliteTable("task_templates", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  todoJson: text("todo_json").notNull(),
  ...timestamps,
}, (table) => [index("task_templates_user_name_idx").on(table.userId, table.name)]);
