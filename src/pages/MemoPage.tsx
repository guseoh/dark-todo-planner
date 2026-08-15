import { FormEvent, useEffect, useMemo, useState } from "react";
import { ListPlus, Pencil, Pin, PinOff, Plus, Save, Search, Trash2, X } from "lucide-react";
import { EmptyState } from "../components/common/EmptyState";
import { Modal } from "../components/common/Modal";
import { MarkdownEditor } from "../components/editor/MarkdownEditor";
import { MarkdownPreview } from "../components/editor/MarkdownPreview";
import { formatKoreanDate, todayKey } from "../lib/date";
import type { Memo, MemoInput } from "../types/memo";
import type { Todo, TodoInput } from "../types/todo";

const memoColors = [
  { label: "슬레이트", value: "#1e293b", className: "border-slate-500/35 bg-slate-500/10" },
  { label: "인디고", value: "#3730a3", className: "border-indigo-400/35 bg-indigo-500/10" },
  { label: "에메랄드", value: "#065f46", className: "border-emerald-400/35 bg-emerald-500/10" },
  { label: "앰버", value: "#92400e", className: "border-amber-400/35 bg-amber-500/10" },
  { label: "로즈", value: "#9f1239", className: "border-rose-400/35 bg-rose-500/10" },
];

const DRAFT_PREFIX = "dark-todo-planner:memo-draft:";
const colorClass = (color?: string) => memoColors.find((item) => item.value === color)?.className || memoColors[0].className;

type MemoDraft = {
  title: string;
  content: string;
  color: string;
  pinned: boolean;
  savedAt: number;
};

const readDraft = (key: string, initial?: Memo): MemoDraft | null => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const draft = JSON.parse(raw) as MemoDraft;
    if (!draft || typeof draft.savedAt !== "number") return null;
    if (initial && draft.savedAt <= Date.parse(initial.updatedAt)) return null;
    return draft;
  } catch {
    return null;
  }
};

const memoDisplayTitle = (memo: Memo) =>
  memo.title || memo.content.split("\n").find((line) => line.trim())?.replace(/^[-#>*\s]+/, "").slice(0, 28) || "제목 없음";

const uncheckedChecklistTitles = (content: string) =>
  content
    .split("\n")
    .map((line) => line.match(/^\s*-\s*\[\s\]\s+(.+)$/)?.[1]?.trim())
    .filter((value): value is string => Boolean(value));

type MemoFormProps = {
  initial?: Memo;
  submitLabel: string;
  onSubmit: (input: MemoInput) => unknown | Promise<unknown>;
  onCancel?: () => void;
  large?: boolean;
  draftKey: string;
};

function MemoForm({ initial, submitLabel, onSubmit, onCancel, large = false, draftKey }: MemoFormProps) {
  const initialDraft = useMemo(() => readDraft(draftKey, initial), [draftKey, initial]);
  const [title, setTitle] = useState(initialDraft?.title ?? initial?.title ?? "");
  const [content, setContent] = useState(initialDraft?.content ?? initial?.content ?? "");
  const [color, setColor] = useState(initialDraft?.color ?? initial?.color ?? memoColors[0].value);
  const [pinned, setPinned] = useState(initialDraft?.pinned ?? initial?.pinned ?? false);
  const [error, setError] = useState("");
  const [draftSavedAt, setDraftSavedAt] = useState(initialDraft?.savedAt || 0);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const draft: MemoDraft = { title, content, color, pinned, savedAt: Date.now() };
      try {
        localStorage.setItem(draftKey, JSON.stringify(draft));
        setDraftSavedAt(draft.savedAt);
      } catch {
        // Draft autosave is best-effort. Server save remains the source of truth.
      }
    }, 350);
    return () => window.clearTimeout(timer);
  }, [color, content, draftKey, pinned, title]);

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
    try {
      localStorage.removeItem(draftKey);
    } catch {
      // Ignore local draft cleanup failures after a successful server save.
    }
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
    <form onSubmit={submit} className="space-y-4">
      <label className="block space-y-1 text-sm font-semibold text-ink-300">
        제목
        <input
          className="field min-h-11 text-base font-semibold"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="메모 제목을 입력하세요"
          autoFocus={Boolean(initial)}
        />
      </label>

      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
        <label className="block space-y-1 text-sm font-semibold text-ink-300">
          색상
          <select className="field min-h-11" value={color} onChange={(event) => setColor(event.target.value)} aria-label="메모 색상">
            {memoColors.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex min-h-11 items-center gap-2 rounded-lg border border-ink-700 bg-ink-950/60 px-3 text-sm font-semibold text-ink-300">
          <input type="checkbox" checked={pinned} onChange={(event) => setPinned(event.target.checked)} className="h-4 w-4 accent-accent-500" />
          고정
        </label>
      </div>

      <MarkdownEditor
        value={content}
        onChange={setContent}
        label="내용"
        placeholder="- 떠오른 생각을 적어두세요"
        textareaClassName={large ? "min-h-[320px] max-h-[60vh]" : "min-h-28"}
      />
      <div className="flex min-h-5 items-center justify-between gap-3">
        {error ? <p className="text-xs text-red-200">{error}</p> : <span />}
        {draftSavedAt ? (
          <p className="text-[11px] text-ink-500" title="브라우저 로컬 초안입니다. 저장 버튼을 누르면 서버에 반영됩니다.">
            초안 자동 저장 · {new Date(draftSavedAt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}
          </p>
        ) : null}
      </div>
      <div className="flex flex-wrap justify-end gap-2 border-t border-ink-700 pt-4">
        {onCancel ? (
          <button type="button" className="btn-secondary" onClick={onCancel}>
            <X size={16} />
            취소
          </button>
        ) : null}
        <button type="submit" className="btn-primary">
          {initial ? <Save size={16} /> : <Plus size={16} />}
          {submitLabel}
        </button>
      </div>
    </form>
  );
}

function MemoCard({
  memo,
  onDelete,
  onTogglePin,
  onEdit,
  onCreateTodo,
  onCreateChecklistTodos,
}: {
  memo: Memo;
  onDelete: (id: string) => unknown | Promise<unknown>;
  onTogglePin: (id: string) => unknown | Promise<unknown>;
  onEdit: (memo: Memo) => void;
  onCreateTodo: (memo: Memo) => void | Promise<void>;
  onCreateChecklistTodos: (memo: Memo, titles: string[]) => void | Promise<void>;
}) {
  const displayTitle = memoDisplayTitle(memo);
  const checklistTitles = uncheckedChecklistTitles(memo.content);

  return (
    <article className={`rounded-xl border p-4 ${colorClass(memo.color)}`}>
      <div className="flex min-h-full flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <button
            type="button"
            className="min-h-11 min-w-0 flex-1 rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/40"
            onClick={() => onEdit(memo)}
            aria-label={`${displayTitle} 메모 수정`}
          >
            <div className="flex min-w-0 items-center gap-2">
              {memo.pinned ? <Pin size={14} className="shrink-0 text-accent-300" /> : null}
              <h3 className="line-clamp-2 text-base font-bold leading-6 text-ink-100" title={displayTitle}>{displayTitle}</h3>
            </div>
            <p className="mt-1 text-xs text-ink-500">{formatKoreanDate(memo.updatedAt, "yyyy.MM.dd 수정")}</p>
          </button>
          <div className="flex shrink-0 gap-1">
            <button
              type="button"
              className="icon-btn h-10 w-10 rounded-md"
              onClick={(event) => {
                event.stopPropagation();
                void onCreateTodo(memo);
              }}
              aria-label={`${displayTitle} 메모를 Todo로 만들기`}
              title="메모를 Todo로 만들기"
            >
              <ListPlus size={14} />
            </button>
            <button
              type="button"
              className="icon-btn h-10 w-10 rounded-md"
              onClick={(event) => {
                event.stopPropagation();
                void onTogglePin(memo.id);
              }}
              aria-label={memo.pinned ? "고정 해제" : "메모 고정"}
              title={memo.pinned ? "고정 해제" : "메모 고정"}
            >
              {memo.pinned ? <PinOff size={14} /> : <Pin size={14} />}
            </button>
            <button
              type="button"
              className="icon-btn h-10 w-10 rounded-md"
              onClick={(event) => {
                event.stopPropagation();
                onEdit(memo);
              }}
              aria-label="메모 수정"
              title="메모 수정"
            >
              <Pencil size={14} />
            </button>
            <button
              type="button"
              className="icon-btn h-10 w-10 rounded-md hover:border-danger hover:text-red-100"
              onClick={(event) => {
                event.stopPropagation();
                if (window.confirm("메모를 삭제할까요? 삭제 후 6초 동안 실행 취소할 수 있습니다.")) void onDelete(memo.id);
              }}
              aria-label="메모 삭제"
              title="메모 삭제"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>
        <div
          className="-m-1 cursor-pointer rounded-lg p-1"
          onClick={(event) => {
            if (event.target instanceof Element && event.target.closest("a")) return;
            onEdit(memo);
          }}
          title="메모 수정"
        >
          <MarkdownPreview className="line-clamp-5 text-sm" value={memo.content} />
        </div>
        {checklistTitles.length ? (
          <button
            type="button"
            className="btn-secondary min-h-9 self-start px-2.5 py-1 text-xs"
            onClick={() => void onCreateChecklistTodos(memo, checklistTitles)}
          >
            <ListPlus size={14} />
            미완료 체크리스트 {checklistTitles.length}개를 Todo로
          </button>
        ) : null}
      </div>
    </article>
  );
}

export function MemoPage({
  memos,
  onAdd,
  onUpdate,
  onDelete,
  onTogglePin,
  onAddTodo,
}: {
  memos: Memo[];
  onAdd: (input: MemoInput) => unknown | Promise<unknown>;
  onUpdate: (id: string, input: MemoInput) => unknown | Promise<unknown>;
  onDelete: (id: string) => unknown | Promise<unknown>;
  onTogglePin: (id: string) => unknown | Promise<unknown>;
  onAddTodo: (input: TodoInput) => Promise<Todo | undefined> | Todo | undefined;
}) {
  const [creating, setCreating] = useState(false);
  const [editingMemo, setEditingMemo] = useState<Memo | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [conversionMessage, setConversionMessage] = useState("");
  const normalizedQuery = searchQuery.trim().toLocaleLowerCase("ko-KR");
  const filteredMemos = normalizedQuery
    ? memos.filter((memo) => `${memo.title || ""}\n${memo.content}`.toLocaleLowerCase("ko-KR").includes(normalizedQuery))
    : memos;
  const pinnedMemos = filteredMemos.filter((memo) => memo.pinned);
  const normalMemos = filteredMemos.filter((memo) => !memo.pinned);

  useEffect(() => {
    if (!conversionMessage) return undefined;
    const timer = window.setTimeout(() => setConversionMessage(""), 3500);
    return () => window.clearTimeout(timer);
  }, [conversionMessage]);

  const createTodoFromMemo = async (memo: Memo) => {
    const title = memoDisplayTitle(memo);
    const todo = await onAddTodo({ title, memo: memo.content, date: todayKey() });
    setConversionMessage(todo ? `“${title}” Todo를 오늘 일정으로 만들었습니다.` : "Todo를 만들지 못했습니다.");
  };

  const createChecklistTodos = async (memo: Memo, titles: string[]) => {
    if (!titles.length) return;
    if (!window.confirm(`미완료 체크리스트 ${titles.length}개를 오늘 Todo로 만들까요?`)) return;
    let created = 0;
    for (const title of titles) {
      const todo = await onAddTodo({
        title,
        memo: memo.title ? `원본 메모: ${memo.title}` : "메모 체크리스트에서 생성",
        date: todayKey(),
      });
      if (todo) created += 1;
    }
    setConversionMessage(`${created}/${titles.length}개 Todo를 만들었습니다.`);
  };

  const renderCard = (memo: Memo) => (
    <MemoCard
      key={memo.id}
      memo={memo}
      onDelete={onDelete}
      onTogglePin={onTogglePin}
      onEdit={setEditingMemo}
      onCreateTodo={createTodoFromMemo}
      onCreateChecklistTodos={createChecklistTodos}
    />
  );

  return (
    <div className="space-y-5">
      <section className="space-y-4">
        <div>
          <h2 className="text-2xl font-bold text-ink-100 sm:text-3xl">메모</h2>
          <p className="mt-2 text-sm text-ink-400">작업 중 떠오른 생각을 저장하고, 필요하면 바로 Todo로 넘깁니다.</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
          <label className="relative block min-w-0 sm:w-80">
            <span className="sr-only">메모 검색</span>
            <Search size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-500" />
            <input
              type="search"
              className="field min-h-11 pl-10"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="제목과 내용 검색"
              aria-label="메모 검색"
            />
          </label>
          <button type="button" className="btn-primary min-h-11 justify-center" onClick={() => setCreating((value) => !value)}>
            {creating ? <X size={17} /> : <Plus size={17} />}
            {creating ? "작성 닫기" : "메모 추가"}
          </button>
        </div>
      </section>

      {conversionMessage ? (
        <div className="rounded-lg border border-success/35 bg-success/10 px-3 py-2 text-sm font-semibold text-ink-200" role="status">
          {conversionMessage}
        </div>
      ) : null}

      {creating ? (
        <section className="app-card p-4">
          <MemoForm
            draftKey={`${DRAFT_PREFIX}new`}
            submitLabel="메모 저장"
            onSubmit={async (input) => {
              await onAdd(input);
              setCreating(false);
            }}
            onCancel={() => setCreating(false)}
          />
        </section>
      ) : null}

      {filteredMemos.length ? (
        <div className="space-y-5">
          {pinnedMemos.length ? (
            <section className="space-y-3">
              <h3 className="text-sm font-bold text-ink-300">고정 메모</h3>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                {pinnedMemos.map(renderCard)}
              </div>
            </section>
          ) : null}

          {normalMemos.length ? (
            <section className="space-y-3">
              <h3 className="text-sm font-bold text-ink-300">일반 메모</h3>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                {normalMemos.map(renderCard)}
              </div>
            </section>
          ) : null}
        </div>
      ) : memos.length ? (
        <EmptyState title="검색 결과가 없습니다." description="다른 제목이나 내용으로 검색해보세요." />
      ) : (
        <EmptyState title="아직 작성한 메모가 없습니다." description="작업 중 떠오른 생각을 가볍게 적어보세요." />
      )}

      {editingMemo ? (
        <Modal title="메모 수정" description="수정 내용은 브라우저 초안으로 자동 저장되며 저장 버튼을 누르면 서버에 반영됩니다." onClose={() => setEditingMemo(null)} size="lg">
          <MemoForm
            initial={editingMemo}
            draftKey={`${DRAFT_PREFIX}${editingMemo.id}`}
            submitLabel="저장"
            large
            onSubmit={async (input) => {
              await onUpdate(editingMemo.id, input);
              setEditingMemo(null);
            }}
            onCancel={() => setEditingMemo(null)}
          />
        </Modal>
      ) : null}
    </div>
  );
}
