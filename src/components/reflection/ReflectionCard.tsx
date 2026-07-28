import { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { formatKoreanDate } from "../../lib/date";
import type { Reflection, ReflectionType } from "../../types/reflection";
import { Modal } from "../common/Modal";
import { MarkdownPreview } from "../editor/MarkdownPreview";
import { ReflectionForm } from "./ReflectionForm";

const typeLabel: Record<ReflectionType, string> = {
  DAILY: "오늘 회고",
  WEEKLY: "주간 회고",
  MONTHLY: "월간 회고",
};

export function ReflectionCard({
  reflection,
  onUpdate,
  onDelete,
}: {
  reflection: Reflection;
  onUpdate: (id: string, updates: Partial<Pick<Reflection, "date" | "type" | "content" | "sections">>) => unknown | Promise<unknown>;
  onDelete: (id: string) => unknown | Promise<unknown>;
}) {
  const [editing, setEditing] = useState(false);

  return (
    <article className="app-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <span className="rounded-full border border-accent-500/35 bg-accent-500/15 px-2.5 py-1 text-xs font-semibold text-indigo-100">
            {typeLabel[reflection.type]}
          </span>
          <p className="mt-3 text-sm text-ink-400">{formatKoreanDate(reflection.date, "yyyy년 M월 d일 EEEE")}</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            className="icon-btn h-10 w-10"
            onClick={() => setEditing(true)}
            aria-label="회고 수정"
            title="회고 수정"
          >
            <Pencil size={16} />
          </button>
          <button
            type="button"
            className="icon-btn h-10 w-10 hover:border-danger hover:text-red-100"
            onClick={() => {
              if (window.confirm("회고를 삭제할까요?")) void onDelete(reflection.id);
            }}
            aria-label="회고 삭제"
            title="회고 삭제"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>
      <div className="mt-4 space-y-4">
        {reflection.sections?.length ? (
          reflection.sections.map((section) => (
            <section key={section.id}>
              <h4 className="text-sm font-bold text-ink-100">{section.title}</h4>
              <MarkdownPreview className="mt-1" value={section.content} emptyText="작성 내용 없음" />
            </section>
          ))
        ) : (
          <MarkdownPreview value={reflection.content || ""} emptyText="작성 내용 없음" />
        )}
      </div>

      {editing ? (
        <Modal
          title="회고 수정"
          description="유형, 날짜와 각 항목의 내용을 수정합니다."
          onClose={() => setEditing(false)}
          size="lg"
        >
          <ReflectionForm
            initial={reflection}
            submitLabel="변경 저장"
            onSubmit={async (input) => {
              await onUpdate(reflection.id, input);
              setEditing(false);
            }}
            onCancel={() => setEditing(false)}
          />
        </Modal>
      ) : null}
    </article>
  );
}
