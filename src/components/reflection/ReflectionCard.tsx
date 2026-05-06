import { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { formatKoreanDate } from "../../lib/date";
import type { Reflection, ReflectionType } from "../../types/reflection";

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
  onUpdate: (id: string, updates: Partial<Pick<Reflection, "date" | "type" | "content" | "sections">>) => void;
  onDelete: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [sections, setSections] = useState(reflection.sections || []);

  const save = () => {
    onUpdate(reflection.id, {
      sections,
      content: sections.map((section) => `${section.title}\n${section.content}`).join("\n\n"),
    });
    setEditing(false);
  };

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
          <button type="button" className="icon-btn" onClick={() => setEditing((value) => !value)} aria-label="회고 수정">
            <Pencil size={16} />
          </button>
          <button
            type="button"
            className="icon-btn hover:border-danger hover:text-red-100"
            onClick={() => window.confirm("회고를 삭제할까요?") && onDelete(reflection.id)}
            aria-label="회고 삭제"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>
      {editing ? (
        <div className="mt-4 space-y-3">
          {sections.map((section) => (
            <label key={section.id} className="block space-y-2 text-sm font-semibold text-ink-200">
              {section.title}
              <textarea
                className="field min-h-24 resize-y"
                value={section.content}
                onChange={(event) =>
                  setSections((current) =>
                    current.map((item) => (item.id === section.id ? { ...item, content: event.target.value } : item)),
                  )
                }
              />
            </label>
          ))}
          <button type="button" className="btn-primary" onClick={save}>
            저장
          </button>
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          {(reflection.sections || []).map((section) => (
            <section key={section.id}>
              <h4 className="text-sm font-bold text-ink-100">{section.title}</h4>
              <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-ink-400">{section.content || "비어 있음"}</p>
            </section>
          ))}
        </div>
      )}
    </article>
  );
}
