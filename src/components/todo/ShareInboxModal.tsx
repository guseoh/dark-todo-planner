import { FormEvent, useEffect, useMemo, useState } from "react";
import { ExternalLink, Inbox } from "lucide-react";
import { normalizeSharedHttpUrl, type ShareTargetDraft } from "../../lib/shareTarget";
import { Modal } from "../common/Modal";

type SaveResult = { ok: boolean; message?: string };

type ShareInboxModalProps = {
  draft: ShareTargetDraft;
  onClose: () => void;
  onSave: (draft: ShareTargetDraft) => Promise<SaveResult>;
};

export function ShareInboxModal({ draft, onClose, onSave }: ShareInboxModalProps) {
  const [title, setTitle] = useState(draft.title);
  const [memo, setMemo] = useState(draft.memo);
  const [referenceUrl, setReferenceUrl] = useState(draft.referenceUrl);
  const [referenceLabel, setReferenceLabel] = useState(draft.referenceLabel);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setTitle(draft.title);
    setMemo(draft.memo);
    setReferenceUrl(draft.referenceUrl);
    setReferenceLabel(draft.referenceLabel);
    setError("");
  }, [draft]);

  const normalizedReferenceUrl = useMemo(() => normalizeSharedHttpUrl(referenceUrl), [referenceUrl]);
  const invalidReferenceUrl = Boolean(referenceUrl.trim()) && !normalizedReferenceUrl;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!title.trim() || saving) return;
    if (invalidReferenceUrl) {
      setError("관련 링크는 http 또는 https 주소만 사용할 수 있습니다.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      const result = await onSave({
        title: title.trim(),
        memo: memo.trim(),
        referenceUrl: normalizedReferenceUrl,
        referenceLabel: normalizedReferenceUrl ? referenceLabel.trim().slice(0, 80) : "",
      });
      if (!result.ok) setError(result.message || "Inbox에 저장하지 못했습니다.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Inbox에 저장하지 못했습니다.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title="Inbox에 공유 내용 추가"
      description="공유받은 내용을 확인한 뒤 저장합니다. 저장 전에는 Todo가 생성되지 않습니다."
      onClose={saving ? () => undefined : onClose}
      size="lg"
    >
      <form className="space-y-4" onSubmit={submit}>
        <div className="rounded-lg border border-accent-500/20 bg-accent-500/[0.05] px-3 py-2.5 text-sm text-ink-300">
          <div className="flex items-center gap-2 font-semibold text-accent-100"><Inbox size={15} />Inbox로 수집</div>
          <p className="mt-1 text-xs text-ink-500">일정은 지정하지 않습니다. 나중에 Inbox에서 날짜·프로젝트·우선순위를 정리할 수 있습니다.</p>
        </div>

        <label className="block space-y-1 text-sm font-semibold text-ink-300">
          제목
          <input
            className="field"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Todo 제목"
            data-modal-initial-focus
          />
        </label>

        <label className="block space-y-1 text-sm font-semibold text-ink-300">
          공유 메모
          <textarea
            className="field min-h-28 resize-y"
            value={memo}
            onChange={(event) => setMemo(event.target.value)}
            placeholder="공유된 설명이나 함께 남길 메모"
          />
        </label>

        <div className="space-y-2 rounded-lg border border-ink-700/60 bg-ink-950/30 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-ink-200">관련 링크</p>
              <p className="mt-0.5 text-xs text-ink-500">웹페이지를 공유한 경우 원문 링크를 Todo에 함께 저장합니다.</p>
            </div>
            {normalizedReferenceUrl ? (
              <a href={normalizedReferenceUrl} target="_blank" rel="noreferrer" className="btn-secondary min-h-8 px-2.5 py-1 text-xs">
                <ExternalLink size={13} />열기
              </a>
            ) : null}
          </div>
          <div className="grid gap-2 sm:grid-cols-[10rem_minmax(0,1fr)]">
            <input
              className="field"
              value={referenceLabel}
              onChange={(event) => setReferenceLabel(event.target.value)}
              placeholder="링크 이름"
              aria-label="관련 링크 이름"
              maxLength={80}
              disabled={!referenceUrl.trim()}
            />
            <input
              className="field"
              type="url"
              value={referenceUrl}
              onChange={(event) => { setReferenceUrl(event.target.value); setError(""); }}
              placeholder="https://..."
              aria-label="관련 링크 URL"
              maxLength={2048}
            />
          </div>
          {invalidReferenceUrl ? <p className="text-xs font-semibold text-red-200">http 또는 https 링크만 사용할 수 있습니다.</p> : null}
        </div>

        {error ? <p role="alert" className="rounded-lg border border-danger/35 bg-danger/[0.06] px-3 py-2 text-sm font-semibold text-red-100">{error}</p> : null}

        <div className="flex flex-col-reverse gap-2 border-t border-ink-700/60 pt-4 sm:flex-row sm:justify-end">
          <button type="button" className="btn-secondary" onClick={onClose} disabled={saving}>취소</button>
          <button type="submit" className="btn-primary" disabled={!title.trim() || saving || invalidReferenceUrl}>
            <Inbox size={16} />{saving ? "저장 중..." : "Inbox에 저장"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
