import { index, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { todos, users } from "./schema";

export const learningItems = sqliteTable("learning_items", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  learningDate: text("learning_date").notNull(),
  type: text("type", { enum: ["DAILY_PROBLEM", "TECH_BLOG"] }).notNull(),
  title: text("title").notNull(),
  summary: text("summary"),
  sourceUrl: text("source_url"),
  sourceName: text("source_name"),
  status: text("status", { enum: ["UNREAD", "READING", "DONE", "SKIPPED"] }).notNull().default("UNREAD"),
  externalKey: text("external_key").notNull(),
  todoId: text("todo_id").references(() => todos.id, { onDelete: "set null" }),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [
  uniqueIndex("learning_items_user_external_key_uidx").on(table.userId, table.externalKey),
  index("learning_items_user_date_type_idx").on(table.userId, table.learningDate, table.type),
  index("learning_items_user_status_date_idx").on(table.userId, table.status, table.learningDate),
  index("learning_items_todo_idx").on(table.todoId),
]);
