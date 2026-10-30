import { FormEvent, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Ellipsis, FolderKanban, Link2, ListPlus, Pencil, Pin, PinOff, Plus, Save, Search, Trash2, X } from "lucide-react";
import { EmptyState } from "../components/common/EmptyState";
import { PageHeader } from "../components/common/PageHeader";
import { Modal } from "../components/common/Modal";
import { Button } from "../components/ui/Button";
import { MarkdownEditor } from "../components/editor/MarkdownEditor";
import { MarkdownPreview } from "../components/editor/MarkdownPreview";
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
  onSaveLinks: (id: string, input: MemoLinksInput) => unknown | Promise<unknown>;
  onRetryCreatedMemo: (id: string, input: MemoInput) => Memo | undefined | Promise<Memo | undefined>;
  todos: Todo[];
  projects: Project[];
  onCancel?: () => void;
  large?: boolean;
  draftKey: string;
};

function MemoForm({ initial, submitLabel, onSubmit, onSaveLinks, onRetryCreatedMemo, todos, projects, onCancel, large = false, draftKey }: MemoFormProps) {
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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const submittingRef = useRef(false);
  const normalizedLinkQuery = linkQuery.trim().toLocaleLowerCase("ko-KR");
  const visibleTodos = todos.filter((todo) => !todo.archived && (!normalizedLinkQuery || todo.title.toLocaleLowerCase("ko-KR").includes(normalizedLinkQuery)));
  const visibleProjects = projects.filter((project) => !normalizedLinkQuery || project.name.toLocaleLowerCase("ko-KR").includes(normalizedLinkQuery));

  useEffect(() => {
    const version = ++draftVersionRef.current;
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
      draftVersionRef.current += 1;
      try { localStorage.removeItem(draftKey); } catch { /* ignore */ }
      setError("");
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
    <form onSubmit={submit} className="space-y-3">
      <label className="block space-y-1 text-xs font-semibold text-ink-400">제목<input className="field text-sm font-semibold" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="메모 제목" autoFocus /></label>
      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
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

      <section aria-label="메모 내용" className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold text-ink-400">내용 · Markdown</span>
          <div className="page-tabs" role="group" aria-label="메모 내용 보기">
            <button type="button" className="page-tab min-h-8" aria-pressed={!previewMode} onClick={() => setPreviewMode(false)}>편집</button>
            <button type="button" className="page-tab min-h-8" aria-pressed={previewMode} onClick={() => setPreviewMode(true)}>미리보기</button>
          </div>
        </div>
        {previewMode ? (
          <div className={`overflow-y-auto border-t border-ui-divider bg-transparent p-4 ${large ? "min-h-[300px] max-h-[55vh]" : "min-h-36"}`}>
            {content.trim() ? <MarkdownPreview value={content} /> : <p className="text-sm text-ink-500">미리 볼 내용이 없습니다.</p>}
          </div>
        ) : (
          <MarkdownEditor value={content} onChange={setContent} placeholder="- 떠오른 생각을 적어두세요" textareaClassName={large ? "min-h-[300px] max-h-[55vh]" : "min-h-36"} />
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

function MemoCard({ memo, onDelete, onTogglePin, onEdit, onCreateTodo, onCreateChecklistTodos }: {
  memo: Memo;
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
    <article className="memo-note group min-w-0" style={memoAccentStyle(memo.color)}>
      <div className="memo-note__body">
        <div className="memo-note__top">
          <button type="button" className="memo-note__title-button" onClick={() => onEdit(memo)}
            aria-label={`${displayTitle} 메모 수정`}>
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
                menuRef.current?.querySelector("summary")?.focus();
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
          onEdit(memo);
        }} title="메모 수정">
          <MarkdownPreview className="memo-note__excerpt text-[13px] leading-[1.65] text-ui-secondary" value={memo.content} />
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
  const [editingMemo, setEditingMemo] = useState<Memo | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [memoView, setMemoView] = useState<"all" | "pinned" | "linked">("all");
  useEffect(() => {
    if (!focusedMemoId) return;
    const memo = memos.find((item) => item.id === focusedMemoId);
    if (memo) {
      setEditingMemo(memo);
      onSearchTargetOpened?.();
    }
  }, [focusedMemoId, memos, onSearchTargetOpened]);
  const [conversionMessage, setConversionMessage] = useState("");
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

  const renderCard = (memo: Memo) => <MemoCard key={memo.id} memo={memo} onDelete={onDelete} onTogglePin={onTogglePin} onEdit={setEditingMemo} onCreateTodo={createTodoFromMemo} onCreateChecklistTodos={createChecklistTodos} />;

  return (
    <div className="page-shell memo-page">
      <PageHeader title="메모" description="아이디어와 작업 맥락을 기록하고 관련 Todo·프로젝트를 연결하세요."
        meta={`전체 ${memos.length}개`}
        actions={<Button variant="secondary" className="memo-action-button" onClick={() => setCreating(true)}><Plus size={16} aria-hidden="true" />새 메모</Button>}
      />
      <div className="page-toolbar memo-toolbar">
        <label className="memo-search relative min-w-0 flex-1">
          <span className="sr-only">메모 검색</span>
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-500" />
          <input type="search" className="field memo-search__input pl-9 pr-10" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="제목 · 본문 · 연결된 작업 검색" aria-label="메모 검색" />
          {searchQuery ? (
            <button type="button" className="memo-search__clear" onClick={() => setSearchQuery("")}
              title="검색어 지우기" aria-label="메모 검색어 지우기"><X size={15} aria-hidden="true" /></button>
          ) : null}
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
        <span className="memo-toolbar__count ml-auto text-xs text-ink-400" role="status">표시 ${filteredMemos.length}개</span>
      </div>

      {conversionMessage ? <div className="rounded-md border border-success/30 bg-success/10 px-3 py-2 text-xs font-semibold text-success" role="status">{conversionMessage}</div> : null}

      {filteredMemos.length ? (
        <div className="memo-collections space-y-8">
          {pinnedMemos.length ? <section className="memo-section space-y-2"><div className="memo-section__heading flex items-center justify-between"><h3 className="text-xs font-bold text-ink-400">고정 메모</h3><span className="text-[10px] text-ink-600">{pinnedMemos.length}개</span></div><div className="memo-note-grid">{pinnedMemos.map(renderCard)}</div></section> : null}
          {normalMemos.length ? <section className="memo-section space-y-2"><div className="memo-section__heading flex items-center justify-between"><h3 className="text-xs font-bold text-ink-400">일반 메모</h3><span className="text-[10px] text-ink-600">{normalMemos.length}개</span></div><div className="memo-note-grid">{normalMemos.map(renderCard)}</div></section> : null}
        </div>
      ) : memos.length ? <EmptyState title="검색 결과가 없습니다." description="검색어를 변경하거나 전체 필터를 선택해보세요." /> : <EmptyState title="아직 작성한 메모가 없습니다." description="새 메모에서 작업 중 떠오른 생각을 가볍게 남겨보세요." />}

      {creating ? (
        <Modal title="새 메모" description="생각을 기록하고 필요할 때 Todo·프로젝트와 연결합니다." onClose={() => setCreating(false)}>
          <MemoForm draftKey={`${DRAFT_PREFIX}new`} submitLabel="메모 저장" todos={todos} projects={projects} onSaveLinks={onUpdateLinks} onRetryCreatedMemo={onUpdate} onSubmit={onAdd} onCancel={() => setCreating(false)} />
        </Modal>
      ) : null}

      {editingMemo ? (
        <Modal title="메모 수정" description="내용과 연결된 Todo·프로젝트를 함께 관리합니다. 입력 내용은 브라우저 초안으로 자동 저장됩니다." onClose={() => setEditingMemo(null)} size="lg">
          <MemoForm initial={editingMemo} draftKey={`${DRAFT_PREFIX}${editingMemo.id}`} submitLabel="저장" large todos={todos} projects={projects} onSaveLinks={onUpdateLinks} onRetryCreatedMemo={onUpdate} onSubmit={(input) => onUpdate(editingMemo.id, input)} onCancel={() => setEditingMemo(null)} />
        </Modal>
      ) : null}
    </div>
  );
}
