import { index, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { todos, users } from "./schema";

export const todoDependencies = sqliteTable("todo_dependencies", {
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  blockingTodoId: text("blocking_todo_id").notNull().references(() => todos.id, { onDelete: "cascade" }),
  blockedTodoId: text("blocked_todo_id").notNull().references(() => todos.id, { onDelete: "cascade" }),
  createdAt: text("created_at").notNull(),
}, (table) => [
  primaryKey({ columns: [table.blockingTodoId, table.blockedTodoId] }),
  index("todo_dependencies_user_blocked_idx").on(table.userId, table.blockedTodoId),
  index("todo_dependencies_user_blocking_idx").on(table.userId, table.blockingTodoId),
]);
