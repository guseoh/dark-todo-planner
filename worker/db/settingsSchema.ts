import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { users } from "./schema";

export const plannerSettings = sqliteTable("planner_settings", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }).unique(),
  carryOverEnabled: integer("carry_over_enabled", { mode: "boolean" }).notNull().default(false),
  autoArchiveCompleted: integer("auto_archive_completed", { mode: "boolean" }).notNull().default(false),
  reminderTodayEnabled: integer("reminder_today_enabled", { mode: "boolean" }).notNull().default(true),
  reminderOverdueEnabled: integer("reminder_overdue_enabled", { mode: "boolean" }).notNull().default(false),
  reminderDueSoonEnabled: integer("reminder_due_soon_enabled", { mode: "boolean" }).notNull().default(false),
  reminderDueSoonDays: integer("reminder_due_soon_days").notNull().default(3),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});
