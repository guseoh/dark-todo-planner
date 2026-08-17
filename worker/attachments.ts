import type { Bindings } from "./types";

export type AttachmentEntityType = "TODO" | "MEMO";

type AttachmentObjectRow = { id: string; objectKey: string };

const attachmentRowsForEntity = async (env: Bindings, userId: string, entityType: AttachmentEntityType, entityId: string) => {
  const result = await env.DB.prepare(
    "SELECT id, object_key AS objectKey FROM attachments WHERE user_id = ? AND entity_type = ? AND entity_id = ?",
  ).bind(userId, entityType, entityId).all<AttachmentObjectRow>();
  return result.results || [];
};

export async function deleteAttachmentsForEntity(env: Bindings, userId: string, entityType: AttachmentEntityType, entityId: string) {
  const rows = await attachmentRowsForEntity(env, userId, entityType, entityId);
  if (!rows.length) return 0;
  await Promise.all(rows.map((row) => env.ATTACHMENTS.delete(row.objectKey)));
  await env.DB.prepare("DELETE FROM attachments WHERE user_id = ? AND entity_type = ? AND entity_id = ?")
    .bind(userId, entityType, entityId)
    .run();
  return rows.length;
}

export async function deleteAttachmentsForEntities(env: Bindings, userId: string, entityType: AttachmentEntityType, entityIds: string[]) {
  const uniqueIds = Array.from(new Set(entityIds.filter(Boolean)));
  let deleted = 0;
  for (const entityId of uniqueIds) deleted += await deleteAttachmentsForEntity(env, userId, entityType, entityId);
  return deleted;
}
