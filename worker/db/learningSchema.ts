import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
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
  categories: text("categories"),
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

export const learningSyncState = sqliteTable("learning_sync_state", {
  userId: text("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  lastAttemptAt: text("last_attempt_at"),
  lastSuccessAt: text("last_success_at"),
  codeReadingCount: integer("code_reading_count").notNull().default(0),
  techBlogCount: integer("tech_blog_count").notNull().default(0),
  codeReadingError: text("code_reading_error"),
  techBlogError: text("tech_blog_error"),
});

export const learningAiGuides = sqliteTable("learning_ai_guides", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  learningItemId: text("learning_item_id").notNull().references(() => learningItems.id, { onDelete: "cascade" }),
  sourceHash: text("source_hash").notNull(),
  content: text("content").notNull(),
  model: text("model").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [
  uniqueIndex("learning_ai_guides_user_item_uidx").on(table.userId, table.learningItemId),
  index("learning_ai_guides_item_idx").on(table.learningItemId),
]);
