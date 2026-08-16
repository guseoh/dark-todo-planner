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

export const projects = sqliteTable("projects", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  status: text("status", { enum: ["PLANNING", "ACTIVE", "ON_HOLD", "DONE"] }).notNull().default("ACTIVE"),
  color: text("color"),
  icon: text("icon"),
  startDate: text("start_date"),
  targetDate: text("target_date"),
  archived: integer("archived", { mode: "boolean" }).notNull().default(false),
  archivedAt: text("archived_at"),
  order: integer("sort_order").notNull().default(0),
  ...timestamps,
}, (table) => [
  index("projects_user_archived_order_idx").on(table.userId, table.archived, table.order),
  index("projects_user_status_target_idx").on(table.userId, table.status, table.targetDate),
]);

export const projectDecisions = sqliteTable("project_decisions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  decision: text("decision").notNull(),
  rationale: text("rationale"),
  decidedAt: text("decided_at").notNull(),
  ...timestamps,
}, (table) => [index("project_decisions_project_decided_idx").on(table.projectId, table.decidedAt)]);

export const milestones = sqliteTable("milestones", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  targetDate: text("target_date"),
  status: text("status", { enum: ["TODO", "IN_PROGRESS", "DONE"] }).notNull().default("TODO"),
  order: integer("sort_order").notNull().default(0),
  ...timestamps,
}, (table) => [index("milestones_project_order_idx").on(table.projectId, table.order, table.targetDate)]);

export const todos = sqliteTable("todos", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  categoryId: text("category_id").references(() => categories.id, { onDelete: "set null" }),
  projectId: text("project_id").references(() => projects.id, { onDelete: "set null" }),
  milestoneId: text("milestone_id").references(() => milestones.id, { onDelete: "set null" }),
  parentTodoId: text("parent_todo_id"),
  title: text("title").notNull(),
  memo: text("memo"),
  referenceUrl: text("reference_url"),
  referenceLabel: text("reference_label"),
  date: text("date").notNull(),
  dueDate: text("due_date"),
  startTime: text("start_time"),
  endTime: text("end_time"),
  estimateMinutes: integer("estimate_minutes"),
  planningState: text("planning_state", { enum: ["INBOX", "SCHEDULED", "SOMEDAY", "WAITING"] }).notNull().default("SCHEDULED"),
  workflowStatus: text("workflow_status", { enum: ["TODO", "IN_PROGRESS", "BLOCKED", "DONE"] }).notNull().default("TODO"),
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
  index("todos_user_planning_date_idx").on(table.userId, table.planningState, table.date),
  index("todos_user_project_status_idx").on(table.userId, table.projectId, table.workflowStatus),
  index("todos_project_milestone_idx").on(table.projectId, table.milestoneId),
  index("todos_parent_idx").on(table.parentTodoId),
  index("todos_due_date_idx").on(table.dueDate),
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

export const memoTodoLinks = sqliteTable("memo_todo_links", {
  memoId: text("memo_id").notNull().references(() => memos.id, { onDelete: "cascade" }),
  todoId: text("todo_id").notNull().references(() => todos.id, { onDelete: "cascade" }),
  createdAt: text("created_at").notNull(),
}, (table) => [primaryKey({ columns: [table.memoId, table.todoId] }), index("memo_todo_links_todo_idx").on(table.todoId)]);

export const memoProjectLinks = sqliteTable("memo_project_links", {
  memoId: text("memo_id").notNull().references(() => memos.id, { onDelete: "cascade" }),
  projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  createdAt: text("created_at").notNull(),
}, (table) => [primaryKey({ columns: [table.memoId, table.projectId] }), index("memo_project_links_project_idx").on(table.projectId)]);

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

export const notificationSendRecords = sqliteTable("notification_send_records", {
  id: text("id").primaryKey(),
  plannerDate: text("planner_date").notNull(),
  provider: text("provider", { enum: ["discord"] }).notNull(),
  status: text("status", { enum: ["PENDING", "SENT"] }).notNull(),
  sentAt: text("sent_at"),
  ...timestamps,
}, (table) => [
  uniqueIndex("notification_send_records_date_provider_uidx").on(table.plannerDate, table.provider),
]);
