import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const attachments = sqliteTable("attachments", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  entityType: text("entity_type", { enum: ["TODO", "MEMO"] }).notNull(),
  entityId: text("entity_id").notNull(),
  objectKey: text("object_key").notNull().unique(),
  fileName: text("file_name").notNull(),
  contentType: text("content_type").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  createdAt: text("created_at").notNull(),
}, (table) => [index("attachments_user_entity_idx").on(table.userId, table.entityType, table.entityId, table.createdAt)]);
