import { index, integer, primaryKey, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

const timestamps = {
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
};

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  nickname: text("nickname"),
  ...timestamps,
});

export const categories = sqliteTable("categories", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  color: text("color"),
  icon: text("icon"),
  order: integer("sort_order").notNull().default(0),
  ...timestamps,
}, (table) => [index("categories_user_order_idx").on(table.userId, table.order, table.createdAt)]);

export const todos = sqliteTable("todos", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  categoryId: text("category_id").references(() => categories.id, { onDelete: "set null" }),
  title: text("title").notNull(),
  memo: text("memo"),
  date: text("date").notNull(),
  startTime: text("start_time"),
  endTime: text("end_time"),
  priority: text("priority", { enum: ["LOW", "MEDIUM", "HIGH"] }).notNull().default("MEDIUM"),
  completed: integer("completed", { mode: "boolean" }).notNull().default(false),
  repeat: text("repeat", { enum: ["NONE", "DAILY", "WEEKLY", "MONTHLY", "WEEKDAY", "WEEKEND"] }).notNull().default("NONE"),
  archived: integer("archived", { mode: "boolean" }).notNull().default(false),
  archivedAt: text("archived_at"),
  order: integer("sort_order").notNull().default(0),
  ...timestamps,
}, (table) => [
  index("todos_user_archived_date_idx").on(table.userId, table.archived, table.date),
  index("todos_user_category_order_idx").on(table.userId, table.categoryId, table.order),
  index("todos_user_created_idx").on(table.userId, table.createdAt),
]);

export const tags = sqliteTable("tags", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  ...timestamps,
}, (table) => [uniqueIndex("tags_user_name_uidx").on(table.userId, table.name)]);

export const todoTags = sqliteTable("todo_tags", {
  todoId: text("todo_id").notNull().references(() => todos.id, { onDelete: "cascade" }),
  tagId: text("tag_id").notNull().references(() => tags.id, { onDelete: "cascade" }),
}, (table) => [primaryKey({ columns: [table.todoId, table.tagId] }), index("todo_tags_tag_idx").on(table.tagId)]);

export const reflections = sqliteTable("reflections", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  date: text("date").notNull(),
  type: text("type", { enum: ["DAILY", "WEEKLY", "MONTHLY"] }).notNull(),
  sectionsJson: text("sections_json").notNull().default("[]"),
  content: text("content"),
  ...timestamps,
}, (table) => [index("reflections_user_type_date_idx").on(table.userId, table.type, table.date), index("reflections_user_updated_idx").on(table.userId, table.updatedAt)]);

export const goals = sqliteTable("goals", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  type: text("type", { enum: ["DAILY", "WEEKLY", "MONTHLY"] }).notNull().default("DAILY"),
  targetDate: text("target_date"),
  weekStartDate: text("week_start_date"),
  weekEndDate: text("week_end_date"),
  month: text("month"),
  dueDate: text("due_date"),
  progress: integer("progress").notNull().default(0),
  completed: integer("completed", { mode: "boolean" }).notNull().default(false),
  ...timestamps,
}, (table) => [
  index("goals_user_type_target_idx").on(table.userId, table.type, table.targetDate),
  index("goals_user_week_idx").on(table.userId, table.weekStartDate),
  index("goals_user_month_idx").on(table.userId, table.month),
]);

export const memos = sqliteTable("memos", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  title: text("title"), content: text("content").notNull(), color: text("color"),
  pinned: integer("pinned", { mode: "boolean" }).notNull().default(false),
  ...timestamps,
}, (table) => [index("memos_user_pinned_updated_idx").on(table.userId, table.pinned, table.updatedAt)]);

export const topics = sqliteTable("topics", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(), memo: text("memo"),
  status: text("status", { enum: ["IDEA", "WRITING", "DONE"] }).notNull().default("IDEA"),
  tagsJson: text("tags_json").notNull().default("[]"), icon: text("icon"),
  ...timestamps,
}, (table) => [index("topics_user_status_updated_idx").on(table.userId, table.status, table.updatedAt)]);

export const topicLinks = sqliteTable("topic_links", {
  id: text("id").primaryKey(),
  topicId: text("topic_id").notNull().references(() => topics.id, { onDelete: "cascade" }),
  title: text("title"), url: text("url").notNull(), description: text("description"),
  ...timestamps,
}, (table) => [index("topic_links_topic_created_idx").on(table.topicId, table.createdAt)]);

export const musicLinks = sqliteTable("music_links", {
  id: text("id").primaryKey(), userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(), url: text("url").notNull(), provider: text("provider"), memo: text("memo"),
  ...timestamps,
}, (table) => [index("music_links_user_updated_idx").on(table.userId, table.updatedAt)]);

export const focusSessions = sqliteTable("focus_sessions", {
  id: text("id").primaryKey(), userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  todoId: text("todo_id").references(() => todos.id, { onDelete: "set null" }), todoTitle: text("todo_title"),
  mode: text("mode", { enum: ["FOCUS", "SHORT_BREAK", "LONG_BREAK"] }).notNull(), durationMinutes: integer("duration_minutes").notNull(),
  startedAt: text("started_at").notNull(), endedAt: text("ended_at").notNull(), completed: integer("completed", { mode: "boolean" }).notNull().default(true), createdAt: text("created_at").notNull(),
}, (table) => [index("focus_sessions_user_started_idx").on(table.userId, table.startedAt), index("focus_sessions_todo_idx").on(table.todoId)]);

export const timerSettings = sqliteTable("timer_settings", {
  id: text("id").primaryKey(), userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }).unique(),
  focusMinutes: integer("focus_minutes").notNull().default(25), shortBreakMinutes: integer("short_break_minutes").notNull().default(5),
  longBreakMinutes: integer("long_break_minutes").notNull().default(15), sessionsBeforeLongBreak: integer("sessions_before_long_break").notNull().default(4),
  soundEnabled: integer("sound_enabled", { mode: "boolean" }).notNull().default(true), notificationEnabled: integer("notification_enabled", { mode: "boolean" }).notNull().default(false),
  ...timestamps,
});
