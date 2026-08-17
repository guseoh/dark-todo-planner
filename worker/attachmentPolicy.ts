export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
export const MAX_ATTACHMENTS_PER_ENTITY = 10;

export const sanitizeAttachmentFileName = (value: string) => value
  .replace(/[\r\n\0]/g, "")
  .trim()
  .slice(0, 180) || "attachment";

export const buildAttachmentObjectKey = (userId: string, entityType: "TODO" | "MEMO", entityId: string, attachmentId: string) =>
  `users/${encodeURIComponent(userId)}/${entityType.toLowerCase()}/${encodeURIComponent(entityId)}/${attachmentId}`;

export const buildAttachmentContentDisposition = (fileName: string) => {
  const safe = sanitizeAttachmentFileName(fileName);
  const ascii = safe.replace(/[^\x20-\x7E]/g, "_").replace(/["\\]/g, "_") || "attachment";
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(safe)}`;
};

export const validateAttachmentSize = (size: number) => {
  if (!Number.isFinite(size) || size < 0) return "파일 크기가 올바르지 않습니다.";
  if (size > MAX_ATTACHMENT_BYTES) return "첨부파일은 파일당 최대 10 MiB까지 업로드할 수 있습니다.";
  return "";
};
