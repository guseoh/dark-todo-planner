import { FormEvent, useEffect, useMemo, useState } from "react";
import { FolderKanban, Link2, ListPlus, Pencil, Pin, PinOff, Plus, Save, Search, Trash2, X } from "lucide-react";
import { AttachmentPanel } from "../components/common/AttachmentPanel";
import { EmptyState } from "../components/common/EmptyState";
import { Modal } from "../components/common/Modal";
import { MarkdownEditor } from "../components/editor/MarkdownEditor";
import { MarkdownPreview } from "../components/editor/MarkdownPreview";
import { formatKoreanDate, todayKey } from "../lib/date";
import type { Memo, MemoInput, MemoLinksInput } from "../types/memo";
import type { Project } from "../types/project";
import type { Todo, TodoInput } from "../types/todo";

const memoColors = [
  { label: "슬레이트", value: "#1e293b", className: "border-slate-500/30 bg-slate-500/[0.07]" },
  { label: "인디고", value: "#3730a3", className: "border-indigo-400/30 bg-indigo-500/[0.07]" },
  { label: "에메랄드", value: "#065f46", className: "border-emerald-400/30 bg-emerald-500/[0.07]" },
  { label: "앰버", value: "#92400e", className: "border-amber-400/30 bg-amber-500/[0.07]" },
  { label: "로즈", value: "#9f1239", className: "border-rose-400/30 bg-rose-500/[0.07]" },
];

const DRAFT_PREFIX = "dark-todo-planner:memo-draft:";
const colorClass = (color?: string) => memoColors.find((item) => item.value === color)?.className || memoColors[0].className;

type MemoDraft = { title: string; content: string; color: string; pinned: boolean; savedAt: number };

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
  todos: Todo[];
  projects: Project[];
  onCancel?: () => void;
  large?: boolean;
  draftKey: string;
};

function MemoForm({ initial, submitLabel, onSubmit, onSaveLinks, todos, projects, onCancel, large = false, draftKey }: MemoFormProps) {
  const initialDraft = useMemo(() => readDraft(draftKey, initial), [draftKey, initial]);
  const [title, setTitle] = useState(initialDraft?.title ?? initial?.title ?? "");
  const [content, setContent] = useState(initialDraft?.content ?? initial?.content ?? "");
  const [color, setColor] = useState(initialDraft?.color ?? initial?.color ?? memoColors[0].value);
  const [pinned, setPinned] = useState(initialDraft?.pinned ?? initial?.pinned ?? false);
  const [todoIds, setTodoIds] = useState<string[]>(initial?.todoIds || []);
  const [projectIds, setProjectIds] = useState<string[]>(initial?.projectIds || []);
  const [linkQuery, setLinkQuery] = useState("");
  const [error, setError] = useState("");
  const [draftSavedAt, setDraftSavedAt] = useState(initialDraft?.savedAt || 0);
  const normalizedLinkQuery = linkQuery.trim().toLocaleLowerCase("ko-KR");
  const visibleTodos = todos.filter((todo) => !todo.archived && (!normalizedLinkQuery || todo.title.toLocaleLowerCase("ko-KR").includes(normalizedLinkQuery)));
  const visibleProjects = projects.filter((project) => !normalizedLinkQuery || project.name.toLocaleLowerCase("ko-KR").includes(normalizedLinkQuery));

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const draft: MemoDraft = { title, content, color, pinned, savedAt: Date.now() };
      try {
        localStorage.setItem(draftKey, JSON.stringify(draft));
        setDraftSavedAt(draft.savedAt);
      } catch {
        // Browser draft autosave is best-effort.
      }
    }, 350);
    return () => window.clearTimeout(timer);
  }, [color, content, draftKey, pinned, title]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const contentValue = content.trim();
    if (!contentValue) { setError("메모 내용을 입력해주세요."); return; }
    try {
      const saved = await onSubmit({ title: title.trim() || undefined, content: contentValue, color, pinned });
      if (!saved) { setError("메모를 저장하지 못했습니다."); return; }
      await onSaveLinks(saved.id, { todoIds, projectIds });
      try { localStorage.removeItem(draftKey); } catch { /* ignore */ }
      if (!initial) {
        setTitle(""); setContent(""); setColor(memoColors[0].value); setPinned(false); setTodoIds([]); setProjectIds([]);
      }
      setError("");
      onCancel?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "메모를 저장하지 못했습니다.");
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <label className="block space-y-1 text-xs font-semibold text-ink-400">제목<input className="field text-sm font-semibold" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="메모 제목" autoFocus /></label>
      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
        <label className="block space-y-1 text-xs font-semibold text-ink-400">색상<select className="field" value={color} onChange={(event) => setColor(event.target.value)} aria-label="메모 색상">{memoColors.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
        <label className="flex min-h-9 items-center gap-2 rounded-md border border-ink-700/65 bg-ink-950/55 px-3 text-xs font-semibold text-ink-300"><input type="checkbox" checked={pinned} onChange={(event) => setPinned(event.target.checked)} className="h-4 w-4 accent-accent-500" />고정</label>
      </div>

      <MarkdownEditor value={content} onChange={setContent} label="내용" placeholder="- 떠오른 생각을 적어두세요" textareaClassName={large ? "min-h-[300px] max-h-[55vh]" : "min-h-36"} />

      <details className="rounded-md border border-ink-700/60 bg-ink-950/30 p-3">
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

      {initial ? <AttachmentPanel entityType="MEMO" entityId={initial.id} /> : <p className="text-xs text-ink-500">첨부파일은 메모를 한 번 저장한 뒤 수정 화면에서 추가할 수 있습니다.</p>}

      <div className="flex min-h-5 items-center justify-between gap-3">
        {error ? <p className="text-xs text-red-200">{error}</p> : <span />}
        {draftSavedAt ? <p className="text-[10px] text-ink-500" title="브라우저 로컬 초안입니다. 저장 버튼을 누르면 서버에 반영됩니다.">초안 저장 · {new Date(draftSavedAt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}</p> : null}
      </div>
      <div className="flex flex-wrap justify-end gap-2 border-t border-ink-700/60 pt-3">
        {onCancel ? <button type="button" className="btn-secondary" onClick={onCancel}><X size={15} />취소</button> : null}
        <button type="submit" className="btn-primary">{initial ? <Save size={15} /> : <Plus size={15} />}{submitLabel}</button>
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
  return (
    <article className={`group rounded-lg border p-3 transition hover:border-ink-500/70 ${colorClass(memo.color)}`}>
      <div className="flex min-h-full flex-col gap-2.5">
        <div className="flex items-start justify-between gap-2">
          <button type="button" className="min-w-0 flex-1 rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/35" onClick={() => onEdit(memo)} aria-label={`${displayTitle} 메모 수정`}>
            <div className="flex min-w-0 items-center gap-1.5">{memo.pinned ? <Pin size={13} className="shrink-0 text-accent-300" /> : null}<h3 className="line-clamp-1 text-sm font-bold leading-5 text-ink-100" title={displayTitle}>{displayTitle}</h3></div>
            <p className="mt-0.5 text-[10px] text-ink-500">{formatKoreanDate(memo.updatedAt, "yyyy.MM.dd 수정")}</p>
          </button>
          <div className="flex shrink-0 gap-1 opacity-80 transition sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
            <button type="button" className="icon-btn h-8 w-8" onClick={(event) => { event.stopPropagation(); void onCreateTodo(memo); }} aria-label={`${displayTitle} 메모를 Todo로 만들기`} title="Todo로 만들기"><ListPlus size={13} /></button>
            <button type="button" className="icon-btn h-8 w-8" onClick={(event) => { event.stopPropagation(); void onTogglePin(memo.id); }} aria-label={memo.pinned ? "고정 해제" : "메모 고정"} title={memo.pinned ? "고정 해제" : "메모 고정"}>{memo.pinned ? <PinOff size={13} /> : <Pin size={13} />}</button>
            <button type="button" className="icon-btn h-8 w-8" onClick={(event) => { event.stopPropagation(); onEdit(memo); }} aria-label="메모 수정" title="수정"><Pencil size={13} /></button>
            <button type="button" className="icon-btn h-8 w-8 hover:border-danger hover:text-red-100" onClick={(event) => { event.stopPropagation(); if (window.confirm("메모를 삭제할까요? 삭제 후 6초 동안 실행 취소할 수 있습니다.")) void onDelete(memo.id); }} aria-label="메모 삭제" title="삭제"><Trash2 size={13} /></button>
          </div>
        </div>
        <div className="-m-1 cursor-pointer rounded-md p-1" onClick={(event) => { if (event.target instanceof Element && event.target.closest("a")) return; onEdit(memo); }} title="메모 수정"><MarkdownPreview className="line-clamp-3 text-xs leading-5 text-ink-300" value={memo.content} /></div>
        {memo.todoIds.length || memo.projectIds.length ? (
          <div className="flex flex-wrap gap-1 text-[10px] font-semibold text-ink-400">
            {memo.todoIds.length ? <span className="rounded-full bg-ink-950/55 px-1.5 py-0.5"><ListPlus size={11} className="mr-1 inline" />Todo {memo.todoIds.length}</span> : null}
            {memo.projectIds.length ? <span className="rounded-full bg-ink-950/55 px-1.5 py-0.5"><FolderKanban size={11} className="mr-1 inline" />프로젝트 {memo.projectIds.length}</span> : null}
          </div>
        ) : null}
        {checklistTitles.length ? <button type="button" className="btn-secondary min-h-8 self-start px-2 py-1 text-[11px]" onClick={() => void onCreateChecklistTodos(memo, checklistTitles)}><ListPlus size={12} />체크리스트 {checklistTitles.length}개를 Todo로</button> : null}
      </div>
    </article>
  );
}

export function MemoPage({ memos, todos, projects, onAdd, onUpdate, onUpdateLinks, onDelete, onTogglePin, onAddTodo }: {
  memos: Memo[];
  todos: Todo[];
  projects: Project[];
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
  const [conversionMessage, setConversionMessage] = useState("");
  const normalizedQuery = searchQuery.trim().toLocaleLowerCase("ko-KR");
  const filteredMemos = normalizedQuery ? memos.filter((memo) => `${memo.title || ""}\n${memo.content}`.toLocaleLowerCase("ko-KR").includes(normalizedQuery)) : memos;
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
    <div className="space-y-4">
      <section className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div><h2 className="text-2xl font-bold text-ink-100">메모</h2><p className="mt-1 text-sm text-ink-500">생각과 작업 맥락을 기록하고 Todo·프로젝트에 연결합니다.</p></div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <label className="relative block min-w-0 sm:w-72"><span className="sr-only">메모 검색</span><Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-500" /><input type="search" className="field pl-9" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="메모 검색" aria-label="메모 검색" /></label>
          <button type="button" className="btn-primary" onClick={() => setCreating(true)}><Plus size={15} />새 메모</button>
        </div>
      </section>

      {conversionMessage ? <div className="rounded-md border border-success/30 bg-success/10 px-3 py-2 text-xs font-semibold text-emerald-100" role="status">{conversionMessage}</div> : null}

      {filteredMemos.length ? (
        <div className="space-y-4">
          {pinnedMemos.length ? <section className="space-y-2"><div className="flex items-center justify-between"><h3 className="text-xs font-bold text-ink-400">고정 메모</h3><span className="text-[10px] text-ink-600">{pinnedMemos.length}개</span></div><div className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">{pinnedMemos.map(renderCard)}</div></section> : null}
          {normalMemos.length ? <section className="space-y-2"><div className="flex items-center justify-between"><h3 className="text-xs font-bold text-ink-400">일반 메모</h3><span className="text-[10px] text-ink-600">{normalMemos.length}개</span></div><div className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">{normalMemos.map(renderCard)}</div></section> : null}
        </div>
      ) : memos.length ? <EmptyState title="검색 결과가 없습니다." description="다른 제목이나 내용으로 검색해보세요." /> : <EmptyState title="아직 작성한 메모가 없습니다." description="새 메모에서 작업 중 떠오른 생각을 가볍게 남겨보세요." />}

      {creating ? (
        <Modal title="새 메모" description="생각을 기록하고 필요할 때 Todo·프로젝트와 연결합니다." onClose={() => setCreating(false)}>
          <MemoForm draftKey={`${DRAFT_PREFIX}new`} submitLabel="메모 저장" todos={todos} projects={projects} onSaveLinks={onUpdateLinks} onSubmit={onAdd} onCancel={() => setCreating(false)} />
        </Modal>
      ) : null}

      {editingMemo ? (
        <Modal title="메모 수정" description="내용과 연결된 Todo·프로젝트를 함께 관리합니다. 입력 내용은 브라우저 초안으로 자동 저장됩니다." onClose={() => setEditingMemo(null)} size="lg">
          <MemoForm initial={editingMemo} draftKey={`${DRAFT_PREFIX}${editingMemo.id}`} submitLabel="저장" large todos={todos} projects={projects} onSaveLinks={onUpdateLinks} onSubmit={(input) => onUpdate(editingMemo.id, input)} onCancel={() => setEditingMemo(null)} />
        </Modal>
      ) : null}
    </div>
  );
}
