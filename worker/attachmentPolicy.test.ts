import { describe, expect, it } from "vitest";
import {
  buildAttachmentContentDisposition,
  buildAttachmentObjectKey,
  MAX_ATTACHMENT_BYTES,
  sanitizeAttachmentFileName,
  validateAttachmentSize,
} from "./attachmentPolicy";

describe("attachment policy", () => {
  it("keeps R2 keys independent from user supplied filenames", () => {
    expect(buildAttachmentObjectKey("single-user", "TODO", "todo-1", "att-1"))
      .toBe("users/single-user/todo/todo-1/att-1");
  });

  it("removes header control characters and emits UTF-8 content disposition", () => {
    expect(sanitizeAttachmentFileName("보고서\r\n.pdf")).toBe("보고서.pdf");
    const value = buildAttachmentContentDisposition("한글 보고서.pdf");
    expect(value).toContain("attachment;");
    expect(value).toContain("filename*=UTF-8''");
    expect(value).toContain("%ED%95%9C%EA%B8%80");
  });

  it("enforces the application 10 MiB upload limit", () => {
    expect(validateAttachmentSize(MAX_ATTACHMENT_BYTES)).toBe("");
    expect(validateAttachmentSize(MAX_ATTACHMENT_BYTES + 1)).toContain("10 MiB");
  });
});
