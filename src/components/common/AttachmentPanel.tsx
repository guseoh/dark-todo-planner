import { Download, Paperclip, Trash2, Upload } from "lucide-react";
import { ChangeEvent, useCallback, useEffect, useRef, useState } from "react";
import { api } from "../../lib/api/client";
import type { Attachment, AttachmentEntityType } from "../../types/attachment";

const MAX_FILE_BYTES = 10 * 1024 * 1024;

const formatBytes = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(bytes < 10 * 1024 ? 1 : 0)} KiB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MiB`;
};

type Props = {
  entityType: AttachmentEntityType;
  entityId: string;
};

export function AttachmentPanel({ entityType, entityId }: Props) {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [limit, setLimit] = useState(10);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api<{ attachments: Attachment[]; limit: number }>(`/api/attachments?entityType=${entityType}&entityId=${encodeURIComponent(entityId)}`);
      setAttachments(result.attachments);
      setLimit(result.limit);
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "첨부파일을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [entityId, entityType]);

  useEffect(() => { void load(); }, [load]);

  const upload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setError("첨부파일 업로드는 온라인 상태에서만 사용할 수 있습니다.");
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setError("첨부파일은 파일당 최대 10 MiB까지 업로드할 수 있습니다.");
      return;
    }
    if (attachments.length >= limit) {
      setError(`첨부파일은 항목당 최대 ${limit}개까지 추가할 수 있습니다.`);
      return;
    }
    setUploading(true);
    setError("");
    try {
      const body = new FormData();
      body.append("file", file);
      const result = await api<{ attachment: Attachment }>(`/api/attachments/${entityType}/${encodeURIComponent(entityId)}`, { method: "POST", body });
      setAttachments((current) => [...current, result.attachment]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "첨부파일을 업로드하지 못했습니다.");
    } finally {
      setUploading(false);
    }
  };

  const remove = async (attachment: Attachment) => {
    if (!window.confirm(`“${attachment.fileName}” 첨부파일을 삭제할까요?`)) return;
    try {
      await api(`/api/attachments/${attachment.id}`, { method: "DELETE" });
      setAttachments((current) => current.filter((item) => item.id !== attachment.id));
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "첨부파일을 삭제하지 못했습니다.");
    }
  };

  return (
    <section className="space-y-2 rounded-lg border border-ink-700/60 bg-ink-950/30 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-200"><Paperclip size={14} />첨부파일</p>
          <p className="mt-0.5 text-xs text-ink-500">파일당 10 MiB · 최대 {limit}개 · 다운로드는 로그인 상태에서만 가능합니다.</p>
        </div>
        <button type="button" className="btn-secondary min-h-8 px-2.5 py-1 text-xs" disabled={uploading || attachments.length >= limit} onClick={() => inputRef.current?.click()}>
          <Upload size={13} />{uploading ? "업로드 중..." : "파일 추가"}
        </button>
        <input ref={inputRef} type="file" className="hidden" onChange={upload} />
      </div>

      {loading ? <p className="text-xs text-ink-500">첨부파일을 불러오는 중...</p> : attachments.length ? (
        <div className="space-y-1.5">
          {attachments.map((attachment) => (
            <div key={attachment.id} className="flex items-center gap-2 rounded-md border border-ink-800 bg-ink-950/45 px-2.5 py-2">
              <Paperclip size={13} className="shrink-0 text-ink-500" />
              <div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold text-ink-200" title={attachment.fileName}>{attachment.fileName}</p><p className="text-[10px] text-ink-500">{formatBytes(attachment.sizeBytes)}</p></div>
              <a href={attachment.downloadUrl} className="icon-btn h-8 w-8" title="다운로드" aria-label={`${attachment.fileName} 다운로드`}><Download size={13} /></a>
              <button type="button" className="icon-btn h-8 w-8 hover:border-danger hover:text-red-100" title="첨부 삭제" aria-label={`${attachment.fileName} 삭제`} onClick={() => void remove(attachment)}><Trash2 size={13} /></button>
            </div>
          ))}
        </div>
      ) : <p className="text-xs text-ink-600">첨부된 파일이 없습니다.</p>}
      {error ? <p className="text-xs font-semibold text-red-200" role="alert">{error}</p> : null}
    </section>
  );
}
