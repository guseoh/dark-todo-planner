import { FormEvent, useState } from "react";
import { Pencil, Pin, PinOff, Plus, Save, Trash2, X } from "lucide-react";
import { EmptyState } from "../components/common/EmptyState";
import { MarkdownEditor } from "../components/editor/MarkdownEditor";
import { MarkdownPreview } from "../components/editor/MarkdownPreview";
import { formatKoreanDate } from "../lib/date";
import type { Memo, MemoInput } from "../types/memo";

const memoColors = [
  { label: "슬레이트", value: "#1e293b", className: "border-slate-500/35 bg-slate-500/10" },
  { label: "인디고", value: "#3730a3", className: "border-indigo-400/35 bg-indigo-500/10" },
  { label: "에메랄드", value: "#065f46", className: "border-emerald-400/35 bg-emerald-500/10" },
  { label: "앰버", value: "#92400e", className: "border-amber-400/35 bg-amber-500/10" },
  { label: "로즈", value: "#9f1239", className: "border-rose-400/35 bg-rose-500/10" },
];

const colorClass = (color?: string) => memoColors.find((item) => item.value === color)?.className || memoColors[0].className;

type MemoFormProps = {
  initial?: Memo;
  submitLabel: string;
  onSubmit: (input: MemoInput) => unknown | Promise<unknown>;
  onCancel?: () => void;
};

function MemoForm({ initial, submitLabel, onSubmit, onCancel }: MemoFormProps) {
  const [title, setTitle] = useState(initial?.title || "");
  const [content, setContent] = useState(initial?.content || "");
  const [color, setColor] = useState(initial?.color || memoColors[0].value);
  const [pinned, setPinned] = useState(initial?.pinned || false);
  const [error, setError] = useState("");

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const contentValue = content.trim();
    if (!contentValue) {
      setError("메모 내용을 입력해주세요.");
      return;
    }
    await onSubmit({
      title: title.trim() || undefined,
      content: contentValue,
      color,
      pinned,
    });
    if (!initial) {
      setTitle("");
      setContent("");
      setColor(memoColors[0].value);
      setPinned(false);
    }
    setError("");
    onCancel?.();
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_12rem_auto] md:items-center">
        <input className="field" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="제목 선택" />
        <select className="field" value={color} onChange={(event) => setColor(event.target.value)} aria-label="메모 색상">
          {memoColors.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
        <label className="flex min-h-10 items-center gap-2 rounded-lg border border-ink-700 bg-ink-950/60 px-3 text-sm text-ink-300">
          <input type="checkbox" checked={pinned} onChange={(event) => setPinned(event.target.checked)} className="h-4 w-4 accent-accent-500" />
          고정
        </label>
      </div>
      <MarkdownEditor value={content} onChange={setContent} placeholder="- 떠오른 생각을 적어두세요" />
      {error ? <p className="text-xs text-red-200">{error}</p> : null}
      <div className="flex flex-wrap gap-2">
        <button type="submit" className="btn-primary">
          {initial ? <Save size={16} /> : <Plus size={16} />}
          {submitLabel}
        </button>
        {onCancel ? (
          <button type="button" className="btn-secondary" onClick={onCancel}>
            <X size={16} />
            취소
          </button>
        ) : null}
      </div>
    </form>
  );
}

function MemoCard({
  memo,
  onUpdate,
  onDelete,
  onTogglePin,
}: {
  memo: Memo;
  onUpdate: (id: string, input: MemoInput) => unknown | Promise<unknown>;
  onDelete: (id: string) => unknown | Promise<unknown>;
  onTogglePin: (id: string) => unknown | Promise<unknown>;
}) {
  const [editing, setEditing] = useState(false);
  const displayTitle = memo.title || memo.content.split("\n").find(Boolean)?.slice(0, 28) || "제목 없음";

  return (
    <article className={`rounded-xl border p-4 ${colorClass(memo.color)}`}>
      {editing ? (
        <MemoForm
          initial={memo}
          submitLabel="메모 저장"
          onSubmit={(input) => onUpdate(memo.id, input)}
          onCancel={() => setEditing(false)}
        />
      ) : (
        <div className="flex min-h-full flex-col gap-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex min-w-0 items-center gap-2">
                {memo.pinned ? <Pin size={14} className="shrink-0 text-accent-300" /> : null}
                <h3 className="truncate text-base font-bold text-ink-100">{displayTitle}</h3>
              </div>
              <p className="mt-1 text-xs text-ink-500">{formatKoreanDate(memo.updatedAt, "yyyy.MM.dd 수정")}</p>
            </div>
            <div className="flex shrink-0 gap-1">
              <button type="button" className="icon-btn min-h-8 min-w-8 rounded-md" onClick={() => onTogglePin(memo.id)} aria-label={memo.pinned ? "고정 해제" : "메모 고정"}>
                {memo.pinned ? <PinOff size={14} /> : <Pin size={14} />}
              </button>
              <button type="button" className="icon-btn min-h-8 min-w-8 rounded-md" onClick={() => setEditing(true)} aria-label="메모 수정">
                <Pencil size={14} />
              </button>
              <button
                type="button"
                className="icon-btn min-h-8 min-w-8 rounded-md hover:border-danger hover:text-red-100"
                onClick={() => window.confirm("메모를 삭제할까요?") && onDelete(memo.id)}
                aria-label="메모 삭제"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
          <MarkdownPreview className="line-clamp-8 text-sm" value={memo.content} />
        </div>
      )}
    </article>
  );
}

export function MemoPage({
  memos,
  onAdd,
  onUpdate,
  onDelete,
  onTogglePin,
}: {
  memos: Memo[];
  onAdd: (input: MemoInput) => unknown | Promise<unknown>;
  onUpdate: (id: string, input: MemoInput) => unknown | Promise<unknown>;
  onDelete: (id: string) => unknown | Promise<unknown>;
  onTogglePin: (id: string) => unknown | Promise<unknown>;
}) {
  const [creating, setCreating] = useState(false);
  const pinnedMemos = memos.filter((memo) => memo.pinned);
  const normalMemos = memos.filter((memo) => !memo.pinned);

  return (
    <div className="space-y-5">
      <section className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-ink-100 sm:text-3xl">메모</h2>
          <p className="mt-2 text-sm text-ink-400">작업 중 떠오른 생각과 짧은 기록을 스티커 메모처럼 저장합니다.</p>
        </div>
        <button type="button" className="btn-primary" onClick={() => setCreating((value) => !value)}>
          {creating ? <X size={17} /> : <Plus size={17} />}
          {creating ? "닫기" : "메모 추가"}
        </button>
      </section>

      {creating ? (
        <section className="app-card p-4">
          <MemoForm
            submitLabel="메모 저장"
            onSubmit={async (input) => {
              await onAdd(input);
              setCreating(false);
            }}
            onCancel={() => setCreating(false)}
          />
        </section>
      ) : null}

      {memos.length ? (
        <div className="space-y-5">
          {pinnedMemos.length ? (
            <section className="space-y-3">
              <h3 className="text-sm font-bold text-ink-300">고정 메모</h3>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                {pinnedMemos.map((memo) => (
                  <MemoCard key={memo.id} memo={memo} onUpdate={onUpdate} onDelete={onDelete} onTogglePin={onTogglePin} />
                ))}
              </div>
            </section>
          ) : null}

          <section className="space-y-3">
            <h3 className="text-sm font-bold text-ink-300">전체 메모</h3>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {normalMemos.map((memo) => (
                <MemoCard key={memo.id} memo={memo} onUpdate={onUpdate} onDelete={onDelete} onTogglePin={onTogglePin} />
              ))}
            </div>
          </section>
        </div>
      ) : (
        <EmptyState title="아직 작성한 메모가 없습니다." description="작업 중 떠오른 생각을 가볍게 적어보세요." />
      )}
    </div>
  );
}
