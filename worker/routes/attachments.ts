import { and, asc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { Hono } from "hono";
import {
  buildAttachmentContentDisposition,
  buildAttachmentObjectKey,
  MAX_ATTACHMENTS_PER_ENTITY,
  sanitizeAttachmentFileName,
  validateAttachmentSize,
} from "../attachmentPolicy";
import { attachments } from "../db/attachmentSchema";
import type { Bindings, Variables } from "../types";
import { newId, nowIso } from "../utils";

export const attachmentRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>();

type EntityType = "TODO" | "MEMO";

const parseEntityType = (value: string | undefined): EntityType | undefined => value === "TODO" || value === "MEMO" ? value : undefined;

const ensureEntity = async (env: Bindings, userId: string, entityType: EntityType, entityId: string) => {
  const table = entityType === "TODO" ? "todos" : "memos";
  return env.DB.prepare(`SELECT id FROM ${table} WHERE id = ? AND user_id = ? LIMIT 1`).bind(entityId, userId).first<{ id: string }>();
};

const serializeAttachment = (row: typeof attachments.$inferSelect) => ({
  id: row.id,
  entityType: row.entityType,
  entityId: row.entityId,
  fileName: row.fileName,
  contentType: row.contentType,
  sizeBytes: row.sizeBytes,
  createdAt: row.createdAt,
  downloadUrl: `/api/attachments/${row.id}/download`,
});

attachmentRoutes.get("/attachments", async (c) => {
  const entityType = parseEntityType(c.req.query("entityType"));
  const entityId = c.req.query("entityId")?.trim();
  if (!entityType || !entityId) return c.json({ message: "첨부 대상을 지정해주세요." }, 400);
  const db = drizzle(c.env.DB);
  const rows = await db.select().from(attachments).where(and(
    eq(attachments.userId, c.get("userId")),
    eq(attachments.entityType, entityType),
    eq(attachments.entityId, entityId),
  )).orderBy(asc(attachments.createdAt));
  return c.json({ attachments: rows.map(serializeAttachment), limit: MAX_ATTACHMENTS_PER_ENTITY });
});

attachmentRoutes.post("/attachments/:entityType/:entityId", async (c) => {
  const entityType = parseEntityType(c.req.param("entityType"));
  const entityId = c.req.param("entityId")?.trim();
  const userId = c.get("userId");
  if (!entityType || !entityId) return c.json({ message: "첨부 대상을 지정해주세요." }, 400);
  if (!await ensureEntity(c.env, userId, entityType, entityId)) return c.json({ message: "첨부 대상을 찾을 수 없습니다." }, 404);

  const countResult = await c.env.DB.prepare("SELECT COUNT(*) AS count FROM attachments WHERE user_id = ? AND entity_type = ? AND entity_id = ?")
    .bind(userId, entityType, entityId)
    .first<{ count: number }>();
  if ((countResult?.count || 0) >= MAX_ATTACHMENTS_PER_ENTITY) return c.json({ message: `첨부파일은 항목당 최대 ${MAX_ATTACHMENTS_PER_ENTITY}개까지 추가할 수 있습니다.` }, 400);

  const form = await c.req.formData();
  const value = form.get("file");
  if (!(value instanceof File)) return c.json({ message: "업로드할 파일을 선택해주세요." }, 400);
  const sizeError = validateAttachmentSize(value.size);
  if (sizeError) return c.json({ message: sizeError }, 400);

  const id = newId();
  const fileName = sanitizeAttachmentFileName(value.name);
  const contentType = (value.type || "application/octet-stream").slice(0, 160);
  const objectKey = buildAttachmentObjectKey(userId, entityType, entityId, id);
  const createdAt = nowIso();

  await c.env.ATTACHMENTS.put(objectKey, value.stream(), {
    httpMetadata: { contentType },
    customMetadata: { attachmentId: id, entityType, entityId },
  });

  const db = drizzle(c.env.DB);
  const row = { id, userId, entityType, entityId, objectKey, fileName, contentType, sizeBytes: value.size, createdAt };
  try {
    await db.insert(attachments).values(row);
  } catch (error) {
    await c.env.ATTACHMENTS.delete(objectKey).catch(() => undefined);
    throw error;
  }
  return c.json({ attachment: serializeAttachment(row) }, 201);
});

attachmentRoutes.get("/attachments/:id/download", async (c) => {
  const db = drizzle(c.env.DB);
  const [row] = await db.select().from(attachments).where(and(eq(attachments.id, c.req.param("id")), eq(attachments.userId, c.get("userId")))).limit(1);
  if (!row) return c.json({ message: "첨부파일을 찾을 수 없습니다." }, 404);
  const object = await c.env.ATTACHMENTS.get(row.objectKey);
  if (!object) return c.json({ message: "첨부파일 본문을 찾을 수 없습니다." }, 404);
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("Content-Type", row.contentType || "application/octet-stream");
  headers.set("Content-Length", String(row.sizeBytes));
  headers.set("Content-Disposition", buildAttachmentContentDisposition(row.fileName));
  headers.set("Cache-Control", "private, no-store");
  headers.set("ETag", object.httpEtag);
  return new Response(object.body, { headers });
});

attachmentRoutes.delete("/attachments/:id", async (c) => {
  const db = drizzle(c.env.DB);
  const [row] = await db.select().from(attachments).where(and(eq(attachments.id, c.req.param("id")), eq(attachments.userId, c.get("userId")))).limit(1);
  if (!row) return c.json({ message: "첨부파일을 찾을 수 없습니다." }, 404);
  await c.env.ATTACHMENTS.delete(row.objectKey);
  await db.delete(attachments).where(eq(attachments.id, row.id));
  return c.json({ ok: true });
});
