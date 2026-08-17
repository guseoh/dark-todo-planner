export type AttachmentEntityType = "TODO" | "MEMO";

export type Attachment = {
  id: string;
  entityType: AttachmentEntityType;
  entityId: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  createdAt: string;
  downloadUrl: string;
};
