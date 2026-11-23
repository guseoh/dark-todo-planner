import { FormEvent, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Ellipsis, FolderKanban, Link2, ListPlus, Pencil, Pin, PinOff, Plus, Save, Search, Trash2, X } from "lucide-react";
import { EmptyState } from "../components/common/EmptyState";
import { PageHeader } from "../components/common/PageHeader";
import { Button } from "../components/ui/Button";
import { MarkdownEditor } from "../components/editor/MarkdownEditor";
import { MarkdownPreview } from "../components/editor/MarkdownPreview";
import { RichMarkdownEditor, type RichMarkdownHandle } from "../components/editor/RichMarkdownEditor";
import { requiresRawScratchpadEditing } from "../lib/scratchpadEditorSafety";
import { formatKoreanDate, todayKey } from "../lib/date";
import type { Memo, MemoInput, MemoLinksInput } from "../types/memo";
import type { Project } from "../types/project";
import type { Todo, TodoInput } from "../types/todo";

/* Keep stored legacy colors intact. All newly chosen colors are selectable. */
const memoColors = [
  { label: "중립", value: "#64748b" },
  { label: "파랑", value: "#3b82f6" },
  { label: "보라", value: "#8b5cf6" },
  { label: "초록", value: "#10b981" },
  { label: "노랑", value: "#f59e0b" },
  { label: "분홍", value: "#ec4899" },
  { label: "빨강", value: "#ef4444" },
] as const;
const DRAFT_PREFIX = "dark-todo-planner:memo-draft:";
const safeMemoColor = (color?: string | null) =>
  typeof color === "string" && /^#[0-9a-fA-F]{6}$/.test(color) ? color : memoColors[0].value;
// Earlier muted palettes remain stored unchanged. Increase their contrast only at render time.
const legacyDisplayColors: Record<string, string> = {
  "#202023": "#3b82f6", "#303034": "#8b5cf6", "#47474c": "#10b981",
  "#1e293b": "#3b82f6", "#3730a3": "#8b5cf6",
};
const memoDisplayColor = (color?: string | null) =>
  legacyDisplayColors[(color || "").toLowerCase()] ?? safeMemoColor(color);
const memoAccentStyle = (color?: string | null): CSSProperties =>
  ({ "--memo-accent": memoDisplayColor(color) }) as CSSProperties;
// Existing unknown but valid colors are not normalized or silently replaced when editing.
const resolveMemoColor = (color?: string | null) => safeMemoColor(color);

type MemoDraft = { title: string; content: string; color: string; pinned: boolean; todoIds?: string[]; projectIds?: string[]; createdMemoId?: string; savedAt: number };

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
  content.split("\n").map((line) => line.match(/^\s*-\s*\[\s\]\s+(.+)$/)?.[1]?.trim()).filter((value): value is string => Boolean(value));

const toggleId = (ids: string[], id: string) => ids.includes(id) ? ids.filter((value) => value !== id) : [...ids, id];

type MemoFormProps = {
  initial?: Memo;
  submitLabel: string;
  onSubmit: (input: MemoInput) => Memo | undefined | Promise<Memo | undefined>;
  onSaved?: (memo: Memo) => void;
  onSaveLinks: (id: string, input: MemoLinksInput) => unknown | Promise<unknown>;
  onRetryCreatedMemo: (id: string, input: MemoInput) => Memo | undefined | Promise<Memo | undefined>;
  todos: Todo[];
  projects: Project[];
  onCancel?: () => void;
  large?: boolean;
  inline?: boolean;
  draftKey: string;
};

function MemoForm({ initial, submitLabel, onSubmit, onSaveLinks, onRetryCreatedMemo, todos, projects, onCancel, onSaved, large = false, inline = false, draftKey }: MemoFormProps) {
  const initialDraft = useMemo(() => readDraft(draftKey, initial), [draftKey, initial]);
  const [title, setTitle] = useState(initialDraft?.title ?? initial?.title ?? "");
  const [content, setContent] = useState(initialDraft?.content ?? initial?.content ?? "");
  const [color, setColor] = useState(resolveMemoColor(initialDraft?.color ?? initial?.color));
  const [pinned, setPinned] = useState(initialDraft?.pinned ?? initial?.pinned ?? false);
  const [todoIds, setTodoIds] = useState<string[]>(initialDraft?.todoIds ?? initial?.todoIds ?? []);
  const [projectIds, setProjectIds] = useState<string[]>(initialDraft?.projectIds ?? initial?.projectIds ?? []);
  const createdMemoIdRef = useRef(initialDraft?.createdMemoId || "");
  const [linkQuery, setLinkQuery] = useState("");
  const [error, setError] = useState("");
  const [draftSavedAt, setDraftSavedAt] = useState(initialDraft?.savedAt || 0);
  const [draftError, setDraftError] = useState("");
  const draftVersionRef = useRef(0);
  const lastDraftRef = useRef<MemoDraft | null>(null);
  const baselineSignatureRef = useRef(JSON.stringify({ title, content, color, pinned, todoIds, projectIds }));
  const changedSinceSaveRef = useRef(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const richEditorRef = useRef<RichMarkdownHandle | null>(null);
  const [sourceMode, setSourceMode] = useState(
    () => requiresRawScratchpadEditing(initialDraft?.content ?? initial?.content ?? ""),
  );
  // Render advanced Markdown as read-only on open; switch to raw source to edit.
  // Never attempt a lossy round-trip of tables, HTML, or math through Tiptap.
  const [sourcePreview, setSourcePreview] = useState(
    () => requiresRawScratchpadEditing(initialDraft?.content ?? initial?.content ?? ""),
  );
  const requiresSource = requiresRawScratchpadEditing(content);
  const showSource = sourceMode || requiresSource;
  const submittingRef = useRef(false);
  const normalizedLinkQuery = linkQuery.trim().toLocaleLowerCase("ko-KR");
  const visibleTodos = todos.filter((todo) => !todo.archived && (!normalizedLinkQuery || todo.title.toLocaleLowerCase("ko-KR").includes(normalizedLinkQuery)));
  const visibleProjects = projects.filter((project) => !normalizedLinkQuery || project.name.toLocaleLowerCase("ko-KR").includes(normalizedLinkQuery));

  // An untouched document is not a pending draft. Save rapid unsaved changes
  // synchronously on note switch, even before the debounce interval expires.
  const currentSignature = JSON.stringify({ title, content, color, pinned, todoIds, projectIds });
  changedSinceSaveRef.current = currentSignature !== baselineSignatureRef.current;
  lastDraftRef.current = { title, content, color, pinned, todoIds, projectIds,
    createdMemoId: createdMemoIdRef.current || undefined, savedAt: Date.now() };
  useEffect(() => {
    return () => {
      if (!changedSinceSaveRef.current || !lastDraftRef.current) return;
      try {
        localStorage.setItem(draftKey, JSON.stringify({ ...lastDraftRef.current, savedAt: Date.now() }));
      } catch { /* Existing in-memory content is left untouched. */ }
    };
  }, [draftKey]);

  useEffect(() => {
    const version = ++draftVersionRef.current;
    if (!changedSinceSaveRef.current) return undefined;
    const timer = window.setTimeout(() => {
      if (version !== draftVersionRef.current) return;
      const draft: MemoDraft = {
        title, content, color, pinned, todoIds, projectIds,
        createdMemoId: createdMemoIdRef.current || undefined, savedAt: Date.now(),
      };
      try {
        localStorage.setItem(draftKey, JSON.stringify(draft));
        setDraftSavedAt(draft.savedAt);
        setDraftError("");
      } catch {
        setDraftError("브라우저 초안을 저장하지 못했습니다. 서버 저장 전에는 창을 닫지 마세요.");
      }
    }, 350);
    return () => window.clearTimeout(timer);
  }, [color, content, draftKey, pinned, title, todoIds, projectIds]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (submittingRef.current) return;

    const contentValue = content.trim();
    if (!contentValue) { setError("메모 내용을 입력해주세요."); return; }

    submittingRef.current = true;
    setIsSubmitting(true);
    // Write a synchronous recovery snapshot before any network request.
    draftVersionRef.current += 1;
    try {
      const snapshot: MemoDraft = {
        title, content, color, pinned, todoIds, projectIds,
        createdMemoId: createdMemoIdRef.current || undefined, savedAt: Date.now(),
      };
      localStorage.setItem(draftKey, JSON.stringify(snapshot));
      setDraftSavedAt(snapshot.savedAt);
    } catch { setDraftError("로컬 초안을 저장하지 못했습니다. 서버 저장 실패 시 창을 닫지 마세요."); }
    try {
      const input: MemoInput = { title: title.trim() || undefined, content: contentValue, color, pinned };
      const saved = !initial && createdMemoIdRef.current
        ? await onRetryCreatedMemo(createdMemoIdRef.current, input)
        : await onSubmit(input);
      if (!saved) { setError("메모를 저장하지 못했습니다. 내용을 유지했으니 다시 시도하세요."); return; }
      if (!initial) {
        createdMemoIdRef.current = saved.id;
        // A successful memo create followed by link failure must not create a duplicate.
        try {
          localStorage.setItem(draftKey, JSON.stringify({
            title, content, color, pinned, todoIds, projectIds, createdMemoId: saved.id, savedAt: Date.now(),
          } satisfies MemoDraft));
        } catch { /* Existing in-memory memo ID still protects this session. */ }
      }
      await onSaveLinks(saved.id, { todoIds, projectIds });
      baselineSignatureRef.current = JSON.stringify({ title, content, color, pinned, todoIds, projectIds });
      changedSinceSaveRef.current = false;
      draftVersionRef.current += 1;
      try { localStorage.removeItem(draftKey); } catch { /* ignore */ }
      setDraftSavedAt(0);
      setError("");
      onSaved?.(saved);
      onCancel?.();
    } catch (err) {
      // Server memo may be saved even when link synchronization fails.
      // Keep its ID with the draft so retry updates, rather than creates.
      try {
        localStorage.setItem(draftKey, JSON.stringify({
          title, content, color, pinned, todoIds, projectIds,
          createdMemoId: createdMemoIdRef.current || undefined, savedAt: Date.now(),
        } satisfies MemoDraft));
      } catch { setDraftError("브라우저 초안을 저장하지 못했습니다. 창을 닫지 말고 다시 시도해 주세요."); }
      setError(err instanceof Error ? err.message : "메모 또는 연결 항목 저장에 실패했습니다. 내용을 유지했습니다.");
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={submit} className={inline ? "memo-document-form" : "space-y-3"}>
      <label className={inline ? "memo-document-title-label" : "block space-y-1 text-xs font-semibold text-ink-400"}><span className={inline ? "sr-only" : ""}>제목</span><input className={inline ? "memo-document-title-input" : "field text-sm font-semibold"} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="메모 제목" autoFocus={!initial} disabled={isSubmitting} /></label>
      <div className={inline ? "memo-document-metadata" : "grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end"}>
        <fieldset className="min-w-0 space-y-1.5">
          <legend className="text-xs font-semibold text-ink-400">메모 색상</legend>
          <div role="group" aria-label="메모 색상 선택" className="memo-color-picker flex min-h-10 flex-wrap items-center gap-2">
            {memoColors.map((item) => (
              <button key={item.value} type="button" aria-label={item.label}
                aria-pressed={color.toLowerCase() === item.value.toLowerCase()}
                title={item.label} onClick={() => setColor(item.value)}
                className="memo-color-swatch" style={{ backgroundColor: item.value }} />
            ))}
            {!memoColors.some((item) => item.value.toLowerCase() === color.toLowerCase()) ? (
              <button type="button" className="memo-color-swatch" style={{ backgroundColor: memoDisplayColor(color) }}
                aria-label="기존 메모 색상" aria-pressed={true} title="기존 메모 색상 유지" />
            ) : null}
          </div>
        </fieldset>
        <label className="flex min-h-9 items-center gap-2 px-2 text-xs font-semibold text-ink-300"><input type="checkbox" checked={pinned} onChange={(event) => setPinned(event.target.checked)} className="h-4 w-4 accent-accent-500" />고정</label>
      </div>

      <section aria-label="메모 내용" className={inline ? "memo-edit-section memo-edit-section--inline space-y-2" : "memo-edit-section space-y-2"}>
        <div className="memo-rich-toolbar">
          <span className="memo-rich-toolbar__label">내용</span>
          {!showSource ? (
            <div role="group" aria-label="메모 서식" className="memo-rich-toolbar__actions">
              {([
                { action: "h1", text: "H1", title: "제목" },
                { action: "bullet", text: "• 목록", title: "글머리 목록" },
                { action: "task", text: "☑", title: "체크리스트" },
                { action: "quote", text: "❝", title: "인용" },
                { action: "bold", text: "B", title: "굵게" },
                { action: "italic", text: "I", title: "기울임" },
                { action: "code", text: "</>", title: "인라인 코드" },
                { action: "link", text: "링크", title: "링크 삽입" },
              ] as const).map(({ action, text, title }) => (
                <button key={action} type="button" title={title} aria-label={title}
                  className="memo-rich-toolbar__action" onClick={() => richEditorRef.current?.action(action)}>
                  {text}
                </button>
              ))}
            </div>
          ) : <span className="memo-rich-toolbar__mode">{sourcePreview ? "Markdown 서식 미리보기" : "Markdown 원본 편집"}</span>}
          {showSource ? <button type="button" className="memo-rich-toolbar__source" onClick={() => setSourcePreview((value) => !value)}
            aria-label={sourcePreview ? "Markdown 원본 편집" : "Markdown 서식 미리보기"}>{sourcePreview ? "원본 편집" : "서식 미리보기"}</button> : null}
          <button type="button" className="memo-rich-toolbar__source" aria-pressed={showSource}
            disabled={requiresSource} title={requiresSource ? "원본 보존이 필요한 문서는 시각 편집으로 전환할 수 없습니다." : "Markdown 원본 편집 전환"}
            onClick={() => setSourceMode((value) => !value)}>
            {showSource ? "시각 편집" : "원본"}
          </button>
        </div>
        {requiresSource ? (
          <p className="memo-rich-compat" role="note">표·HTML·수식 등의 원본 보존을 위해 Markdown으로 편집합니다.</p>
        ) : null}
        {showSource && sourcePreview ? (
          <div className="memo-advanced-preview" aria-label="메모 Markdown 서식 미리보기">
            <MarkdownPreview value={content} />
          </div>
        ) : showSource ? (
          <MarkdownEditor value={content} onChange={setContent} placeholder="- 떠오른 생각을 적어두세요"
            textareaClassName={large ? "min-h-[300px] max-h-[55vh]" : "min-h-36"} />
        ) : (
          <RichMarkdownEditor ref={richEditorRef} variant="memo" markdown={content} onChange={setContent} readOnly={isSubmitting} />
        )}
      </section>

      <details className="border-t border-ui-divider py-3">
        <summary className="cursor-pointer list-none text-xs font-bold text-ink-300">
          <span className="inline-flex items-center gap-2"><Link2 size={14} className="text-accent-300" />연결 · Todo {todoIds.length} · 프로젝트 {projectIds.length}</span>
        </summary>
        <div className="mt-3 space-y-2">
          <input className="field" value={linkQuery} onChange={(event) => setLinkQuery(event.target.value)} placeholder="연결할 Todo 또는 프로젝트 검색" />
          <div className="grid gap-2 md:grid-cols-2">
            <div>
              <p className="mb-1.5 text-[11px] font-bold text-ink-500">Todo</p>
              <div className="max-h-40 space-y-1 overflow-y-auto rounded-md bg-ink-950/45 p-1.5">
                {visibleTodos.length ? visibleTodos.map((todo) => (
                  <label key={todo.id} className="flex cursor-pointer items-start gap-2 rounded-md px-2 py-1.5 text-xs text-ink-300 hover:bg-ink-800/70">
                    <input type="checkbox" checked={todoIds.includes(todo.id)} onChange={() => setTodoIds((current) => toggleId(current, todo.id))} className="mt-0.5 h-4 w-4 accent-accent-500" />
                    <span className="min-w-0 flex-1"><span className="block truncate font-semibold text-ink-200">{todo.title}</span><span className="text-ink-500">{todo.date}</span></span>
                  </label>
                )) : <p className="px-2 py-3 text-center text-xs text-ink-600">연결할 Todo가 없습니다.</p>}
              </div>
            </div>
            <div>
              <p className="mb-1.5 text-[11px] font-bold text-ink-500">프로젝트</p>
              <div className="max-h-40 space-y-1 overflow-y-auto rounded-md bg-ink-950/45 p-1.5">
                {visibleProjects.length ? visibleProjects.map((project) => (
                  <label key={project.id} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-xs text-ink-300 hover:bg-ink-800/70">
                    <input type="checkbox" checked={projectIds.includes(project.id)} onChange={() => setProjectIds((current) => toggleId(current, project.id))} className="h-4 w-4 accent-accent-500" />
                    <span className="min-w-0 flex-1 truncate font-semibold text-ink-200">{project.name}{project.archived ? " · 보관됨" : ""}</span>
                  </label>
                )) : <p className="px-2 py-3 text-center text-xs text-ink-600">연결할 프로젝트가 없습니다.</p>}
              </div>
            </div>
          </div>
        </div>
      </details>

      <div className="flex min-h-5 flex-wrap items-center justify-between gap-3" aria-live="polite">
        {error ? <p role="alert" className="text-xs text-danger">{error}</p> : <span />}
        {draftError ? <p role="alert" className="text-xs text-danger">{draftError}</p> : null}
        {draftSavedAt && !draftError ? <p className="text-xs text-ink-400" title="브라우저 로컬 초안입니다. 저장 버튼을 누르면 서버에 반영됩니다.">브라우저 초안 저장 · {new Date(draftSavedAt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })} · 서버 저장 전</p> : null}
      </div>
      <div className="flex flex-wrap justify-end gap-2 border-t border-ink-700/60 pt-3">
        {onCancel ? <button type="button" className="btn-secondary" onClick={onCancel} disabled={isSubmitting}><X size={15} />취소</button> : null}
        <button type="submit" className="btn-primary" disabled={isSubmitting} aria-busy={isSubmitting}>{initial ? <Save size={15} /> : <Plus size={15} />}{isSubmitting ? "저장 중..." : submitLabel}</button>
      </div>
    </form>
  );
}

/** Scan-friendly excerpt; the full original Markdown is available in the reading pane. */
const memoExcerpt = (markdown: string) => markdown
  .replace(/```[\s\S]*?```/g, " [코드 블록] ")
  .replace(/!\[[^\]]*\]\([^)]+\)/g, "[이미지]")
  .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
  .replace(/(?:^|\n)\s*(?:#{1,6}\s+|[-*+]\s+(?:\[[ xX]\]\s+)?|\d+\.\s+|>\s+)/g, " ")
  .replace(/[`*_~]/g, "")
  .replace(/\s+/g, " ")
  .trim();

function MemoCard({ memo, selected, onSelect, onDelete, onTogglePin, onEdit, onCreateTodo, onCreateChecklistTodos }: {
  memo: Memo;
  selected: boolean;
  onSelect: (memo: Memo) => void;
  onDelete: (id: string) => unknown | Promise<unknown>;
  onTogglePin: (id: string) => unknown | Promise<unknown>;
  onEdit: (memo: Memo) => void;
  onCreateTodo: (memo: Memo) => void | Promise<void>;
  onCreateChecklistTodos: (memo: Memo, titles: string[]) => void | Promise<void>;
}) {
  const displayTitle = memoDisplayTitle(memo);
  const checklistTitles = uncheckedChecklistTitles(memo.content);
  const menuRef = useRef<HTMLDetailsElement | null>(null);
  const closeActions = () => { if (menuRef.current) menuRef.current.open = false; };
  const confirmDelete = () => {
    closeActions();
    if (window.confirm("메모를 삭제할까요? 삭제 후 6초 동안 실행 취소할 수 있습니다.")) void onDelete(memo.id);
  };
  return (
    <article className="memo-note group min-w-0" data-selected={selected ? "true" : "false"} style={memoAccentStyle(memo.color)}>
      <div className="memo-note__body">
        <div className="memo-note__top">
          <button type="button" className="memo-note__title-button" onClick={() => onSelect(memo)}
            aria-label={`${displayTitle} 열기`} aria-pressed={selected}>
            <span className="memo-note__title-line">
              {memo.pinned ? <Pin size={14} className="memo-note__pin" aria-label="고정된 메모" /> : null}
              <h3 className="memo-note__title" title={displayTitle}>{displayTitle}</h3>
            </span>
            <span className="memo-note__date">{formatKoreanDate(memo.updatedAt, "yyyy.MM.dd 수정")}</span>
          </button>
          <details ref={menuRef} className="memo-actions"
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault();
                event.stopPropagation();
                closeActions();
                menuRef.current?.querySelector<HTMLElement>("summary")?.focus();
              }
            }}
            onBlur={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget)) closeActions();
            }}>
            <summary className="memo-actions__trigger" title="메모 작업" aria-label={`${displayTitle} 메모 더보기`}>
              <Ellipsis size={17} aria-hidden="true" />
            </summary>
            <div className="memo-actions__panel" role="group" aria-label={`${displayTitle} 메모 작업`}>
              <button type="button" onClick={() => { closeActions(); onEdit(memo); }}>
                <Pencil size={15} aria-hidden="true" />수정
              </button>
              <button type="button" onClick={() => { closeActions(); void onTogglePin(memo.id); }}>
                {memo.pinned ? <PinOff size={15} aria-hidden="true" /> : <Pin size={15} aria-hidden="true" />}
                {memo.pinned ? "고정 해제" : "메모 고정"}
              </button>
              <button type="button" onClick={() => { closeActions(); void onCreateTodo(memo); }}>
                <ListPlus size={15} aria-hidden="true" />Todo로 만들기
              </button>
              <div className="memo-actions__separator" role="separator" />
              <button type="button" className="memo-actions__danger" onClick={confirmDelete}>
                <Trash2 size={15} aria-hidden="true" />삭제
              </button>
            </div>
          </details>
        </div>
        <div className="memo-note__preview" onClick={(event) => {
          if (event.target instanceof Element && event.target.closest("a")) return;
          onSelect(memo);
        }} title="메모 열기">
          <p className="memo-note__excerpt text-[13px] leading-[1.65] text-ui-secondary">{memoExcerpt(memo.content)}</p>
        </div>
        {memo.todoIds.length || memo.projectIds.length ? (
          <div className="memo-note__links">
            {memo.todoIds.length ? <span><ListPlus size={12} aria-hidden="true" />Todo {memo.todoIds.length}</span> : null}
            {memo.projectIds.length ? <span><FolderKanban size={12} aria-hidden="true" />프로젝트 {memo.projectIds.length}</span> : null}
          </div>
        ) : null}
        {checklistTitles.length ? (
          <button type="button" className="memo-note__checklist-action" onClick={() => void onCreateChecklistTodos(memo, checklistTitles)}>
            <ListPlus size={13} aria-hidden="true" />체크리스트 {checklistTitles.length}개를 Todo로
          </button>
        ) : null}
      </div>
    </article>
  );
}

export function MemoPage({ memos, todos, projects, focusedMemoId, onSearchTargetOpened, onAdd, onUpdate, onUpdateLinks, onDelete, onTogglePin, onAddTodo }: {
  memos: Memo[];
  todos: Todo[];
  projects: Project[];
  focusedMemoId?: string | null;
  onSearchTargetOpened?: () => void;
  onAdd: (input: MemoInput) => Memo | undefined | Promise<Memo | undefined>;
  onUpdate: (id: string, input: MemoInput) => Memo | undefined | Promise<Memo | undefined>;
  onUpdateLinks: (id: string, input: MemoLinksInput) => unknown | Promise<unknown>;
  onDelete: (id: string) => unknown | Promise<unknown>;
  onTogglePin: (id: string) => unknown | Promise<unknown>;
  onAddTodo: (input: TodoInput) => Promise<Todo | undefined> | Todo | undefined;
}) {
  const [creating, setCreating] = useState(false);
  const [previewMemoId, setPreviewMemoId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [memoView, setMemoView] = useState<"all" | "pinned" | "linked">("all");
  useEffect(() => {
    if (!focusedMemoId) return;
    const memo = memos.find((item) => item.id === focusedMemoId);
    if (memo) {
      setPreviewMemoId(memo.id);
      setCreating(false);
      onSearchTargetOpened?.();
    }
  }, [focusedMemoId, memos, onSearchTargetOpened]);
  const [conversionMessage, setConversionMessage] = useState("");
  const [saveMessage, setSaveMessage] = useState("");
  const showSaved = (memo: Memo) => {
    setPreviewMemoId(memo.id);
    setCreating(false);
    setSaveMessage("메모를 서버에 저장했습니다.");
  };
  const normalizedQuery = searchQuery.trim().toLocaleLowerCase("ko-KR");
  const todosById = useMemo(() => new Map(todos.map((todo) => [todo.id, todo.title])), [todos]);
  const projectsById = useMemo(() => new Map(projects.map((project) => [project.id, project.name])), [projects]);
  const filteredMemos = memos.filter((memo) => {
    if (memoView === "pinned" && !memo.pinned) return false;
    if (memoView === "linked" && !memo.todoIds.length && !memo.projectIds.length) return false;
    if (!normalizedQuery) return true;
    const linkedNames = [...memo.todoIds.map((id) => todosById.get(id) || ""), ...memo.projectIds.map((id) => projectsById.get(id) || "")];
    return [memo.title || "", memo.content, ...linkedNames].join("\n").toLocaleLowerCase("ko-KR").includes(normalizedQuery);
  });
  const pinnedMemos = filteredMemos.filter((memo) => memo.pinned);
  const normalMemos = filteredMemos.filter((memo) => !memo.pinned);
  // Always show one document beside the list, even before the first selection.
  // Search and filters determine the fallback document; an explicit selection wins.
  const selectedMemo = filteredMemos.find((memo) => memo.id === previewMemoId) ?? filteredMemos[0] ?? null;
  const selectMemo = (memo: Memo) => {
    setCreating(false);
    setPreviewMemoId(memo.id);
  };

  useEffect(() => {
    if (!conversionMessage) return undefined;
    const timer = window.setTimeout(() => setConversionMessage(""), 3500);
    return () => window.clearTimeout(timer);
  }, [conversionMessage]);

  const createTodoFromMemo = async (memo: Memo) => {
    const title = memoDisplayTitle(memo);
    const todo = await onAddTodo({ title, memo: memo.content, date: todayKey() });
    if (todo) await onUpdateLinks(memo.id, { todoIds: Array.from(new Set([...memo.todoIds, todo.id])), projectIds: memo.projectIds });
    setConversionMessage(todo ? `“${title}” Todo를 만들고 메모와 연결했습니다.` : "Todo를 만들지 못했습니다.");
  };

  const createChecklistTodos = async (memo: Memo, titles: string[]) => {
    if (!titles.length || !window.confirm(`미완료 체크리스트 ${titles.length}개를 오늘 Todo로 만들까요?`)) return;
    const createdIds: string[] = [];
    for (const title of titles) {
      const todo = await onAddTodo({ title, memo: memo.title ? `원본 메모: ${memo.title}` : "메모 체크리스트에서 생성", date: todayKey() });
      if (todo) createdIds.push(todo.id);
    }
    if (createdIds.length) await onUpdateLinks(memo.id, { todoIds: Array.from(new Set([...memo.todoIds, ...createdIds])), projectIds: memo.projectIds });
    setConversionMessage(`${createdIds.length}/${titles.length}개 Todo를 만들고 메모와 연결했습니다.`);
  };

  const renderCard = (memo: Memo) => <MemoCard key={memo.id} memo={memo} selected={!creating && selectedMemo?.id === memo.id} onSelect={selectMemo} onDelete={onDelete} onTogglePin={onTogglePin} onEdit={selectMemo} onCreateTodo={createTodoFromMemo} onCreateChecklistTodos={createChecklistTodos} />;

  return (
    <div className="page-shell memo-page memo-page--workspace">
      <PageHeader title="메모"
        meta={`전체 ${memos.length}개`}
        actions={<Button variant="secondary" className="memo-action-button" onClick={() => setCreating(true)}><Plus size={16} aria-hidden="true" />새 메모</Button>}
      />
      {conversionMessage ? <div className="rounded-md border border-success/30 bg-success/10 px-3 py-2 text-xs font-semibold text-success" role="status">{conversionMessage}</div> : null}
      <div className="memo-workspace memo-workspace--editor">
        <section className="memo-collections" aria-label="메모 목록">
          <div className="memo-list-heading">
            <span>내 메모</span>
            <span>{filteredMemos.length}개</span>
          </div>
          <div className="page-toolbar memo-toolbar">
            <label className="memo-search relative min-w-0 flex-1">
              <span className="sr-only">메모 검색</span>
              <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-500" />
              <input type="search" className="field memo-search__input pl-9 pr-10" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="메모 검색" aria-label="메모 검색" />
              {searchQuery ? <button type="button" className="memo-search__clear" onClick={() => setSearchQuery("")} title="검색어 지우기" aria-label="메모 검색어 지우기"><X size={15} /></button> : null}
            </label>
            <div className="page-tabs memo-tabs" role="group" aria-label="메모 보기 필터">
              {([
                { id: "all", label: "전체" },
                { id: "pinned", label: "고정" },
                { id: "linked", label: "연결됨" },
              ] as const).map((tab) => (
                <button type="button" key={tab.id} className="page-tab memo-filter-tab" aria-pressed={memoView === tab.id} onClick={() => setMemoView(tab.id)}>{tab.label}</button>
              ))}
            </div>
          </div>
          {filteredMemos.length ? (
            <>
              {pinnedMemos.length ? <section className="memo-section"><div className="memo-section__heading"><h3>고정 메모</h3><span>{pinnedMemos.length}개</span></div><div className="memo-note-grid">{pinnedMemos.map(renderCard)}</div></section> : null}
              {normalMemos.length ? <section className="memo-section"><div className="memo-section__heading"><h3>일반 메모</h3><span>{normalMemos.length}개</span></div><div className="memo-note-grid">{normalMemos.map(renderCard)}</div></section> : null}
            </>
          ) : (
            <div className="memo-list-empty"><EmptyState title={memos.length ? "검색 결과가 없습니다." : "아직 메모가 없습니다."} description={memos.length ? "검색어나 필터를 변경해 보세요." : "오른쪽에서 새 메모를 작성할 수 있습니다."} /></div>
          )}
        </section>
        <aside className="memo-document-pane" style={creating ? undefined : memoAccentStyle(selectedMemo?.color)} aria-label="메모 편집기">
          {creating ? (
            <>
              <div className="memo-document-heading"><span className="memo-document-heading__eyebrow">새 문서</span><span className="memo-document-heading__hint">Markdown · Tiptap</span></div>
              <MemoForm key="new" inline draftKey={`${DRAFT_PREFIX}new`} submitLabel="메모 저장" todos={todos} projects={projects} onSaveLinks={onUpdateLinks} onRetryCreatedMemo={onUpdate} onSubmit={onAdd} onSaved={showSaved} onCancel={() => setCreating(false)} />
            </>
          ) : selectedMemo ? (
            <>
              <div className="memo-document-heading">
                <span className="memo-document-heading__eyebrow"><span className="memo-document-heading__color" aria-hidden="true" />문서 편집</span>
                <span className="memo-document-heading__hint">{formatKoreanDate(selectedMemo.updatedAt, "yyyy.MM.dd 수정")}</span>
              </div>
              <MemoForm key={selectedMemo.id} inline initial={selectedMemo} draftKey={`${DRAFT_PREFIX}${selectedMemo.id}`} submitLabel="저장" large todos={todos} projects={projects} onSaveLinks={onUpdateLinks} onRetryCreatedMemo={onUpdate} onSubmit={(input) => onUpdate(selectedMemo.id, input)} onSaved={showSaved} />
            </>
          ) : (
            <div className="memo-document-empty">
              <Pencil size={22} aria-hidden="true" />
              <h2>메모를 선택하거나 새로 작성하세요.</h2>
              <p>선택한 메모를 이 자리에서 바로 편집할 수 있습니다.</p>
              <p>상단의 새 메모 버튼으로 시작할 수 있습니다.</p>
            </div>
          )}
        </aside>
      </div>
      <p role="status" className="sr-only">{saveMessage}</p>
    </div>
  );
}
