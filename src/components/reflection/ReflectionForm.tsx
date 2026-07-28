import { FormEvent, useEffect, useState } from "react";
import { todayKey } from "../../lib/date";
import type { Reflection, ReflectionSection, ReflectionType } from "../../types/reflection";
import { MarkdownEditor } from "../editor/MarkdownEditor";
import { buildInitialReflectionSections, changeReflectionType } from "./reflectionFormState";

const saveErrorMessage = "회고를 저장하지 못했습니다. 잠시 후 다시 시도해주세요.";

export function ReflectionForm({
  initial,
  submitLabel = "회고 저장",
  onSubmit,
  onCancel,
}: {
  initial?: Pick<Reflection, "date" | "type" | "sections" | "content">;
  submitLabel?: string;
  onSubmit: (input: { date: string; type: ReflectionType; sections: ReflectionSection[]; content?: string }) => unknown | Promise<unknown>;
  onCancel: () => void;
}) {
  const initialType = initial?.type || "DAILY";
  const [type, setType] = useState<ReflectionType>(initialType);
  const [date, setDate] = useState(initial?.date || todayKey());
  const [sections, setSections] = useState<ReflectionSection[]>(buildInitialReflectionSections(initial));
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  useEffect(() => {
    const nextType = initial?.type || "DAILY";
    setType(nextType);
    setDate(initial?.date || todayKey());
    setSections(buildInitialReflectionSections(initial));
    setSubmitError("");
  }, [initial]);

  const canSubmit = Boolean(date && sections.some((section) => section.content.trim()));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    setSubmitError("");
    try {
      await onSubmit({
        date,
        type,
        sections,
        content: sections.map((section) => `${section.title}\n${section.content}`).join("\n\n"),
      });
    } catch {
      setSubmitError(saveErrorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block space-y-1 text-sm font-semibold text-ink-300">
          회고 유형
          <select
            className="field min-h-11"
            value={type}
            onChange={(event) => {
              const nextType = event.target.value as ReflectionType;
              setType(nextType);
              setSections((current) => changeReflectionType(current, nextType));
            }}
          >
            <option value="DAILY">일간 회고</option>
            <option value="WEEKLY">주간 회고</option>
            <option value="MONTHLY">월간 회고</option>
          </select>
        </label>
        <label className="block space-y-1 text-sm font-semibold text-ink-300">
          날짜
          <input
            className="field min-h-11"
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            required
          />
        </label>
      </div>
      <div className="space-y-4">
        {sections.map((section) => (
          <MarkdownEditor
            key={section.id}
            label={section.title}
            value={section.content}
            onChange={(value) =>
                setSections((current) =>
                  current.map((item) => (item.id === section.id ? { ...item, content: value } : item)),
                )
            }
          />
        ))}
      </div>
      {submitError ? (
        <p role="alert" className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-red-100">
          {submitError}
        </p>
      ) : null}
      <p className="text-xs text-ink-500">한 개 이상의 항목을 작성하면 저장할 수 있습니다. 비워 둔 항목은 그대로 유지됩니다.</p>
      <div className="flex flex-col-reverse gap-2 border-t border-ink-700 pt-4 sm:flex-row sm:justify-end">
        <button type="button" className="btn-secondary justify-center" onClick={onCancel} disabled={submitting}>
          취소
        </button>
        <button type="submit" className="btn-primary justify-center" disabled={!canSubmit || submitting}>
          {submitting ? "저장 중..." : submitLabel}
        </button>
      </div>
    </form>
  );
}
