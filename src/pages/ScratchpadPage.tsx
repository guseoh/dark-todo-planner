import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { RichScratchpadEditor, type RichScratchpadHandle, type RichAction } from "../components/editor/RichScratchpadEditor";
import { MarkdownPreview } from "../components/editor/MarkdownPreview";
import { Button } from "../components/ui/Button";
import { requiresRawScratchpadEditing } from "../lib/scratchpadEditorSafety";
import { api, jsonBody } from "../lib/api/client";
import { SCRATCHPAD_DRAFT_KEY, isScratchpadRecoveryNeeded, parseScratchpadDraft, type ScratchpadDraft } from "../lib/scratchpadDraft";

type ScratchpadResponse = {
  scratchpad: {
    content: string;
    updatedAt: string | null;
  };
};

type SaveState = "loading" | "saved" | "dirty" | "saving" | "error";
type ScratchpadMenu = "file" | "edit" | "format" | "view";

const AUTOSAVE_DELAY_MS = 700;
const MIN_ZOOM = 80;
const MAX_ZOOM = 160;
const ZOOM_STEP = 10;
const ZOOM_STORAGE_KEY = "dark-todo-planner:scratchpad-zoom";
const WRAP_STORAGE_KEY = "dark-todo-planner:scratchpad-wrap";

const readZoom = () => {
  if (typeof window === "undefined") return 100;
  const value = Number(localStorage.getItem(ZOOM_STORAGE_KEY));
  return Number.isFinite(value) && value >= MIN_ZOOM && value <= MAX_ZOOM ? value : 100;
};

const readWrap = () => typeof window === "undefined" || localStorage.getItem(WRAP_STORAGE_KEY) !== "false";
const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function ScratchpadPage() {
  const editorRef = useRef<HTMLTextAreaElement | null>(null);
  const richEditorRef = useRef<RichScratchpadHandle | null>(null);
  const [sourceMode, setSourceMode] = useState(false);
  const [sourcePreview, setSourcePreview] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const menuBarRef = useRef<HTMLDivElement | null>(null);
  const historyRef = useRef<string[]>([""]);
  const historyIndexRef = useRef(0);
  const loadedRef = useRef(false);
  const recoveryPendingRef = useRef(false);
  const contentRef = useRef("");
  const savedRef = useRef("");
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());

  const [content, setContent] = useState("");
  const [savedContent, setSavedContent] = useState("");
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("loading");
  const [recoveryDraft, setRecoveryDraft] = useState<ScratchpadDraft | null>(null);
  const [localDraftError, setLocalDraftError] = useState(false);
  const [error, setError] = useState("");
  const [wrap, setWrap] = useState(readWrap);
  const [zoom, setZoom] = useState(readZoom);
  const [selectionStart, setSelectionStart] = useState(0);
  const [findOpen, setFindOpen] = useState(false);
  const [replaceOpen, setReplaceOpen] = useState(false);
  const [findText, setFindText] = useState("");
  const [replaceText, setReplaceText] = useState("");
  const [openMenu, setOpenMenu] = useState<ScratchpadMenu | null>(null);

  const resetHistory = useCallback((value: string) => {
    historyRef.current = [value];
    historyIndexRef.current = 0;
  }, []);

  const applyContent = useCallback((next: string, recordHistory = true) => {
    // Tiptap may initialize before GET resolves: never replace a recoverable draft with an empty editor.
    if (!loadedRef.current || recoveryPendingRef.current) return;
    contentRef.current = next;
    setContent(next);
    if (loadedRef.current && next !== savedRef.current) setSaveState("dirty");
    try {
      localStorage.setItem(SCRATCHPAD_DRAFT_KEY, JSON.stringify({ content: next, savedAt: Date.now() }));
      setLocalDraftError(false);
    } catch { setLocalDraftError(true); }
    setRecoveryDraft(null);
    if (!recordHistory) return;
    const current = historyRef.current[historyIndexRef.current];
    if (current === next) return;
    const nextHistory = historyRef.current.slice(0, historyIndexRef.current + 1);
    nextHistory.push(next);
    if (nextHistory.length > 80) nextHistory.shift();
    historyRef.current = nextHistory;
    historyIndexRef.current = nextHistory.length - 1;
  }, []);

  const restoreSelection = useCallback((start: number, end = start) => {
    window.requestAnimationFrame(() => {
      const editor = editorRef.current;
      if (!editor) return;
      editor.focus();
      editor.setSelectionRange(start, end);
      setSelectionStart(start);
    });
  }, []);

  const loadScratchpad = useCallback(async () => {
    setSaveState("loading");
    try {
      const result = await api<ScratchpadResponse>("/api/scratchpad");
      const next = result.scratchpad.content || "";
      const storedDraft = (() => {
        try { return parseScratchpadDraft(localStorage.getItem(SCRATCHPAD_DRAFT_KEY)); }
        catch { return null; }
      })();
      contentRef.current = next;
      savedRef.current = next;
      setContent(next);
      setSourceMode(requiresRawScratchpadEditing(next));
      setSourcePreview(false);
      setSavedContent(next);
      setUpdatedAt(result.scratchpad.updatedAt);
      const recovered = isScratchpadRecoveryNeeded(storedDraft, next) ? storedDraft : null;
      recoveryPendingRef.current = Boolean(recovered);
      setRecoveryDraft(recovered);
      if (storedDraft && storedDraft.content === next) {
        try { localStorage.removeItem(SCRATCHPAD_DRAFT_KEY); } catch { /* no-op */ }
      }
      resetHistory(next);
      loadedRef.current = true;
      setSaveState("saved");
      setError("");
    } catch (err) {
      setSaveState("error");
      setError(err instanceof Error ? err.message : "낙서장을 불러오지 못했습니다.");
    }
  }, [resetHistory]);

  const saveNow = useCallback(async (value = contentRef.current): Promise<boolean> => {
    if (!loadedRef.current) return false;
    // Queue requests to ensure a slower older response can never overwrite newer edits.
    const pending = saveQueueRef.current.then(async () => {
      if (value !== contentRef.current) return false;
      if (value === savedRef.current) {
        setSaveState("saved");
        return true;
      }
      setSaveState("saving");
      try {
        const result = await api<ScratchpadResponse>("/api/scratchpad", {
          method: "PUT", ...jsonBody({ content: value }),
        });
        savedRef.current = result.scratchpad.content;
        setSavedContent(result.scratchpad.content);
        setUpdatedAt(result.scratchpad.updatedAt);
        const latestSaved = contentRef.current === result.scratchpad.content;
        setSaveState(latestSaved ? "saved" : "dirty");
        setError("");
        if (latestSaved) {
          try { localStorage.removeItem(SCRATCHPAD_DRAFT_KEY); } catch { /* no-op */ }
        }
        return true;
      } catch (err) {
        setSaveState("error");
        setError(err instanceof Error ? err.message : "낙서장을 저장하지 못했습니다.");
        return false;
      }
    });
    saveQueueRef.current = pending.then(() => undefined, () => undefined);
    return pending;
  }, []);

  useEffect(() => { void loadScratchpad(); }, [loadScratchpad]);

  useEffect(() => {
    if (!loadedRef.current || content === savedContent) return;
    setSaveState("dirty");
    const timer = window.setTimeout(() => { void saveNow(content); }, AUTOSAVE_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [content, saveNow, savedContent]);

  useEffect(() => {
    localStorage.setItem(ZOOM_STORAGE_KEY, String(zoom));
  }, [zoom]);

  useEffect(() => {
    localStorage.setItem(WRAP_STORAGE_KEY, String(wrap));
  }, [wrap]);

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (content === savedContent) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [content, savedContent]);

  useEffect(() => {
    if (!openMenu) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (!menuBarRef.current?.contains(event.target as Node)) setOpenMenu(null);
    };
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") setOpenMenu(null);
    };
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [openMenu]);

  const selection = () => {
    const editor = editorRef.current;
    if (!editor) return { start: 0, end: 0, text: "" };
    return { start: editor.selectionStart, end: editor.selectionEnd, text: content.slice(editor.selectionStart, editor.selectionEnd) };
  };

  const replaceSelection = (before: string, after = before, fallback = "텍스트") => {
    if (sourcePreview) setSourcePreview(false);
    if (!sourceMode && richEditorRef.current) {
      const action: RichAction = before === "**" ? "bold" : before === "_" ? "italic" : before === "~~" ? "strike" : before === "[" ? "link" : "code";
      richEditorRef.current.action(action);
      return;
    }
    const { start, end, text } = selection();
    const chosen = text || fallback;
    const next = `${content.slice(0, start)}${before}${chosen}${after}${content.slice(end)}`;
    applyContent(next);
    restoreSelection(start + before.length, start + before.length + chosen.length);
  };

  const prefixSelectedLines = (prefix: string) => {
    if (sourcePreview) setSourcePreview(false);
    if (!sourceMode && richEditorRef.current) {
      const action: RichAction = prefix === "# " ? "h1" : prefix === "## " ? "h2" : prefix === "1. " ? "ordered" : prefix === "- [ ] " ? "task" : prefix === "> " ? "quote" : "bullet";
      richEditorRef.current.action(action);
      return;
    }
    const editor = editorRef.current;
    if (!editor) return;
    const start = content.lastIndexOf("\n", Math.max(0, editor.selectionStart - 1)) + 1;
    const lineEndIndex = content.indexOf("\n", editor.selectionEnd);
    const end = lineEndIndex === -1 ? content.length : lineEndIndex;
    const segment = content.slice(start, end);
    const lines = segment.split("\n");
    const shouldRemove = lines.every((line) => !line.trim() || line.startsWith(prefix));
    const changed = lines.map((line) => {
      if (!line.trim()) return line;
      return shouldRemove && line.startsWith(prefix) ? line.slice(prefix.length) : `${prefix}${line}`;
    }).join("\n");
    const next = `${content.slice(0, start)}${changed}${content.slice(end)}`;
    applyContent(next);
    restoreSelection(start, start + changed.length);
  };

  const undo = () => {
    if (!sourceMode) { richEditorRef.current?.undo(); return; }
    if (historyIndexRef.current <= 0) return;
    historyIndexRef.current -= 1;
    const next = historyRef.current[historyIndexRef.current];
    applyContent(next, false);
    restoreSelection(next.length);
  };

  const redo = () => {
    if (!sourceMode) { richEditorRef.current?.redo(); return; }
    if (historyIndexRef.current >= historyRef.current.length - 1) return;
    historyIndexRef.current += 1;
    const next = historyRef.current[historyIndexRef.current];
    applyContent(next, false);
    restoreSelection(next.length);
  };

  const findNext = useCallback(() => {
    const keyword = findText.trim();
    if (!sourceMode) { richEditorRef.current?.findNext(keyword); return; }
    const editor = editorRef.current;
    if (!keyword || !editor) return;
    const haystack = content.toLocaleLowerCase("ko");
    const needle = keyword.toLocaleLowerCase("ko");
    const from = Math.max(editor.selectionEnd, 0);
    let index = haystack.indexOf(needle, from);
    if (index === -1 && from > 0) index = haystack.indexOf(needle, 0);
    if (index === -1) return;
    restoreSelection(index, index + keyword.length);
  }, [content, findText, restoreSelection, sourceMode]);

  const replaceOne = () => {
    const keyword = findText.trim();
    if (!keyword) return;
    if (!sourceMode) { if (!richEditorRef.current?.replaceOne(keyword, replaceText)) findNext(); return; }
    const { start, end, text } = selection();
    if (text.toLocaleLowerCase("ko") !== keyword.toLocaleLowerCase("ko")) {
      findNext();
      return;
    }
    const next = `${content.slice(0, start)}${replaceText}${content.slice(end)}`;
    applyContent(next);
    restoreSelection(start, start + replaceText.length);
  };

  const replaceAll = () => {
    const keyword = findText.trim();
    if (!keyword) return;
    if (!sourceMode) { richEditorRef.current?.replaceAll(keyword, replaceText); return; }
    const regex = new RegExp(escapeRegExp(keyword), "gi");
    const next = content.replace(regex, replaceText);
    if (next === content) return;
    applyContent(next);
    restoreSelection(0);
  };

  const newDocument = () => {
    if (content.trim() && !window.confirm("낙서장 내용을 비울까요? 현재 내용은 서버에 자동 저장됩니다.")) return;
    applyContent("");
    setSourceMode(false);
    restoreSelection(0);
  };

  const openTextFile = async (file?: File) => {
    if (!file) return;
    const text = await file.text();
    applyContent(text);
    setSourceMode(requiresRawScratchpadEditing(text));
    restoreSelection(0);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const downloadText = () => {
    const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `scratchpad-${new Date().toISOString().slice(0, 10)}.md`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const handleEditorKeyDown = (event: KeyboardEvent<HTMLTextAreaElement | HTMLDivElement>) => {
    const command = event.ctrlKey || event.metaKey;
    if (!command) return;
    const key = event.key.toLowerCase();
    if (key === "s") {
      event.preventDefault();
      void saveNow(content);
    } else if (key === "f") {
      event.preventDefault();
      setFindOpen(true);
      setReplaceOpen(false);
    } else if (key === "h") {
      event.preventDefault();
      setFindOpen(true);
      setReplaceOpen(true);
    } else if (key === "z" && !event.shiftKey) {
      event.preventDefault();
      undo();
    } else if (key === "y" || (key === "z" && event.shiftKey)) {
      event.preventDefault();
      redo();
    } else if (key === "0") {
      event.preventDefault();
      setZoom(100);
    } else if (key === "+" || key === "=") {
      event.preventDefault();
      setZoom((value) => Math.min(MAX_ZOOM, value + ZOOM_STEP));
    } else if (key === "-") {
      event.preventDefault();
      setZoom((value) => Math.max(MIN_ZOOM, value - ZOOM_STEP));
    }
  };

  const cursor = useMemo(() => {
    const before = content.slice(0, selectionStart);
    const lines = before.split("\n");
    return { line: lines.length, column: (lines[lines.length - 1]?.length || 0) + 1 };
  }, [content, selectionStart]);

  const saveLabel = saveState === "loading" ? "불러오는 중" : saveState === "saving" ? "저장 중..." : saveState === "dirty" ? "저장 대기" : saveState === "error" ? "저장 오류" : "저장됨";
  const lastSavedLabel = updatedAt ? new Date(updatedAt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" }) : "";

  const menuButtonClass = "rounded px-2 py-1 text-xs font-medium text-ink-300 hover:bg-ink-800 hover:text-ink-100";
  const menuItemClass = "w-full rounded px-3 py-2 text-left text-xs text-ink-200 hover:bg-ink-800";
  const toolButtonClass = "ui-button ui-button--ghost ui-button--sm min-h-9 shrink-0 px-2 text-xs";
  const toggleMenu = (menu: ScratchpadMenu) => setOpenMenu((current) => current === menu ? null : menu);
  const closeMenuAndRun = (action: () => void) => {
    setOpenMenu(null);
    if (sourcePreview) setSourcePreview(false);
    action();
  };

  return (
    <section aria-label="낙서장" className="scratchpad-workspace mx-auto flex min-h-[calc(100vh-6.5rem)] w-full max-w-[1500px] flex-col overflow-hidden bg-ui-canvas">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-ui-divider bg-transparent px-3 py-3">
        <div className="flex items-center gap-2"><h1 className="text-lg font-semibold text-ui-text">낙서장</h1><span className="text-xs text-ink-400">자동 저장</span></div>
      </div>
      <div className="scratchpad-command-strip"><div className="scratchpad-command-strip__menus">
        <div ref={menuBarRef} className="flex items-center gap-0.5">
          <div className="relative">
            <button type="button" className={menuButtonClass} aria-haspopup="menu" aria-expanded={openMenu === "file"} onClick={() => toggleMenu("file")}>파일</button>
            {openMenu === "file" ? (
              <div role="menu" className="absolute left-0 top-full z-40 mt-1 w-44 rounded-md border border-ink-700 bg-ink-900 p-1 shadow-xl">
                <button role="menuitem" type="button" className={menuItemClass} onClick={() => closeMenuAndRun(newDocument)}>새 문서</button>
                <button role="menuitem" type="button" className={menuItemClass} onClick={() => closeMenuAndRun(() => fileInputRef.current?.click())}>Markdown / 텍스트 열기</button>
                <button role="menuitem" type="button" className={menuItemClass} onClick={() => closeMenuAndRun(() => { void saveNow(content); })}>저장 <span className="float-right text-ink-500">Ctrl+S</span></button>
                <button role="menuitem" type="button" className={menuItemClass} onClick={() => closeMenuAndRun(downloadText)}>Markdown 다운로드</button>
              </div>
            ) : null}
          </div>
          <div className="relative">
            <button type="button" className={menuButtonClass} aria-haspopup="menu" aria-expanded={openMenu === "edit"} onClick={() => toggleMenu("edit")}>편집</button>
            {openMenu === "edit" ? (
              <div role="menu" className="absolute left-0 top-full z-40 mt-1 w-44 rounded-md border border-ink-700 bg-ink-900 p-1 shadow-xl">
                <button role="menuitem" type="button" className={menuItemClass} onClick={() => closeMenuAndRun(undo)}>실행 취소 <span className="float-right text-ink-500">Ctrl+Z</span></button>
                <button role="menuitem" type="button" className={menuItemClass} onClick={() => closeMenuAndRun(redo)}>다시 실행 <span className="float-right text-ink-500">Ctrl+Y</span></button>
                <div className="my-1 border-t border-ink-700" />
                <button role="menuitem" type="button" className={menuItemClass} onClick={() => closeMenuAndRun(() => { setFindOpen(true); setReplaceOpen(false); })}>찾기 <span className="float-right text-ink-500">Ctrl+F</span></button>
                <button role="menuitem" type="button" className={menuItemClass} onClick={() => closeMenuAndRun(() => { setFindOpen(true); setReplaceOpen(true); })}>바꾸기 <span className="float-right text-ink-500">Ctrl+H</span></button>
                <button role="menuitem" type="button" className={menuItemClass} onClick={() => closeMenuAndRun(() => { if (sourceMode) { editorRef.current?.focus(); editorRef.current?.select(); } else richEditorRef.current?.selectAll(); })}>전체 선택</button>
              </div>
            ) : null}
          </div>
          <div className="relative">
            <button type="button" className={menuButtonClass} aria-haspopup="menu" disabled={sourcePreview} aria-expanded={openMenu === "format"} onClick={() => toggleMenu("format")}>서식</button>
            {openMenu === "format" ? (
              <div role="menu" className="absolute left-0 top-full z-40 mt-1 w-48 rounded-md border border-ink-700 bg-ink-900 p-1 shadow-xl">
                <button role="menuitem" type="button" className={menuItemClass} onClick={() => closeMenuAndRun(() => prefixSelectedLines("# "))}>제목 H1</button>
                <button role="menuitem" type="button" className={menuItemClass} onClick={() => closeMenuAndRun(() => prefixSelectedLines("- "))}>글머리 목록</button>
                <button role="menuitem" type="button" className={menuItemClass} onClick={() => closeMenuAndRun(() => prefixSelectedLines("1. "))}>번호 목록</button>
                <button role="menuitem" type="button" className={menuItemClass} onClick={() => closeMenuAndRun(() => prefixSelectedLines("- [ ] "))}>체크리스트</button>
                <button role="menuitem" type="button" className={menuItemClass} onClick={() => closeMenuAndRun(() => prefixSelectedLines("> "))}>인용</button>
                <button role="menuitem" type="button" className={menuItemClass} onClick={() => closeMenuAndRun(() => replaceSelection("**", "**"))}>굵게</button>
                <button role="menuitem" type="button" className={menuItemClass} onClick={() => closeMenuAndRun(() => replaceSelection("_", "_"))}>기울임</button>
                <button role="menuitem" type="button" className={menuItemClass} onClick={() => closeMenuAndRun(() => replaceSelection("~~", "~~"))}>취소선</button>
                <button role="menuitem" type="button" className={menuItemClass} onClick={() => closeMenuAndRun(() => replaceSelection("[", "](https://)", "링크"))}>링크</button>
              </div>
            ) : null}
          </div>
          <div className="relative">
            <button type="button" className={menuButtonClass} aria-haspopup="menu" aria-expanded={openMenu === "view"} onClick={() => toggleMenu("view")}>보기</button>
            {openMenu === "view" ? (
              <div role="menu" className="absolute left-0 top-full z-40 mt-1 w-44 rounded-md border border-ink-700 bg-ink-900 p-1 shadow-xl">
                <button role="menuitem" type="button" className={menuItemClass} onClick={() => closeMenuAndRun(() => setWrap((value) => !value))}>자동 줄 바꿈 <span className="float-right">{wrap ? "✓" : ""}</span></button>
                <button role="menuitem" type="button" className={menuItemClass} onClick={() => closeMenuAndRun(() => setZoom((value) => Math.min(MAX_ZOOM, value + ZOOM_STEP)))}>확대</button>
                <button role="menuitem" type="button" className={menuItemClass} onClick={() => closeMenuAndRun(() => setZoom((value) => Math.max(MIN_ZOOM, value - ZOOM_STEP)))}>축소</button>
                <button role="menuitem" type="button" className={menuItemClass} onClick={() => closeMenuAndRun(() => setZoom(100))}>100%</button>
              </div>
            ) : null}
          </div>
        </div>
        <div className="flex items-center gap-2 px-2 text-[11px] text-ink-500">
          <button type="button" className={menuButtonClass} disabled={sourceMode && requiresRawScratchpadEditing(content)} onClick={() => { setSourcePreview(false); setSourceMode((v) => !v); }} aria-pressed={sourceMode}>{sourceMode ? "시각 편집" : "Markdown 원본"}</button>
          {sourceMode ? (
            <Button variant={sourcePreview ? "info" : "secondary"} size="sm"
              onClick={() => setSourcePreview((open) => !open)} aria-pressed={sourcePreview}
              aria-label={sourcePreview ? "Markdown 원본 편집" : "Markdown 서식 미리보기"}>
              {sourcePreview ? "원본 편집" : "서식 미리보기"}
            </Button>
          ) : null}
          <span>{saveLabel}</span>
          {lastSavedLabel && saveState === "saved" ? <span>{lastSavedLabel}</span> : null}
        </div>
      </div>

      {!sourcePreview ? <div className="scratchpad-toolbar flex shrink-0 items-center gap-1 overflow-x-auto border-b border-ui-divider bg-transparent px-2 py-1.5">
        <button type="button" className={toolButtonClass} title="제목 H1" onClick={() => prefixSelectedLines("# ")}>H1</button>
        <button type="button" className={toolButtonClass} title="글머리 목록" onClick={() => prefixSelectedLines("- ")}>• 목록</button>
        <button type="button" className={toolButtonClass} title="번호 목록" onClick={() => prefixSelectedLines("1. ")}>1. 목록</button>
        <button type="button" className={toolButtonClass} title="체크리스트" onClick={() => prefixSelectedLines("- [ ] ")}>☑ 체크</button>
        <button type="button" className={toolButtonClass} title="인용" onClick={() => prefixSelectedLines("> ")}>인용</button>
        <span className="mx-1 h-5 w-px bg-ink-700" />
        <button type="button" className={`${toolButtonClass} text-sm font-black`} title="굵게" onClick={() => replaceSelection("**", "**")}>B</button>
        <button type="button" className={`${toolButtonClass} text-sm italic`} title="기울임" onClick={() => replaceSelection("_", "_")}>I</button>
        <button type="button" className={`${toolButtonClass} text-sm line-through`} title="취소선" onClick={() => replaceSelection("~~", "~~")}>S</button>
        <button type="button" className={toolButtonClass} title="링크" onClick={() => replaceSelection("[", "](https://)", "링크")}>링크</button>
        <span className="ml-auto hidden text-[10px] text-ink-600 sm:block">{sourceMode ? "원본 편집 · 서식 결과는 미리보기에서 확인" : "서식은 바로 적용되며 Markdown으로 저장됩니다."}</span>
      </div> : null}
      </div>

      {findOpen ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-ui-divider bg-transparent px-3 py-3">
          <input autoFocus className="field min-h-8 w-48 py-1 text-xs" value={findText} onChange={(event) => setFindText(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); findNext(); } }} placeholder="찾을 내용" />
          {replaceOpen ? <input className="field min-h-8 w-48 py-1 text-xs" value={replaceText} onChange={(event) => setReplaceText(event.target.value)} placeholder="바꿀 내용" /> : null}
          <button type="button" className="btn-secondary min-h-8 px-2 py-1 text-xs" onClick={findNext}>다음 찾기</button>
          {replaceOpen ? <button type="button" className="btn-secondary min-h-8 px-2 py-1 text-xs" onClick={replaceOne}>바꾸기</button> : null}
          {replaceOpen ? <button type="button" className="btn-secondary min-h-8 px-2 py-1 text-xs" onClick={replaceAll}>모두 바꾸기</button> : null}
          <button type="button" className="ml-auto min-h-8 rounded px-2 text-xs text-ink-500 hover:bg-ink-800 hover:text-ink-200" onClick={() => { setFindOpen(false); setReplaceOpen(false); if (sourceMode) editorRef.current?.focus(); else richEditorRef.current?.focus(); }}>닫기</button>
        </div>
      ) : null}

      {recoveryDraft ? (
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-warning/30 bg-warning/[0.06] px-3 py-2.5" role="status">
          <p className="text-xs text-ink-200">서버 내용과 다른 브라우저 임시 초안이 있습니다. 내용을 비교한 뒤 복원할 수 있습니다.</p>
          <div className="flex gap-2">
            <button type="button" className="btn-secondary text-xs" onClick={() => { recoveryPendingRef.current = false; applyContent(recoveryDraft.content); setSourceMode(requiresRawScratchpadEditing(recoveryDraft.content)); resetHistory(recoveryDraft.content); }}>초안 복원</button>
            <button type="button" className="btn-secondary text-xs" onClick={() => {
              recoveryPendingRef.current = false;
              setRecoveryDraft(null);
              try { localStorage.removeItem(SCRATCHPAD_DRAFT_KEY); } catch { /* no-op */ }
            }}>초안 버리기</button>
          </div>
        </div>
      ) : null}
      {localDraftError ? <p role="alert" className="shrink-0 border-b border-danger/30 px-3 py-2 text-xs text-danger">브라우저 임시 저장이 불가능합니다. 서버에 저장되기 전에는 페이지를 닫지 마세요.</p> : null}
      {error ? <div role="alert" className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-danger/30 bg-danger/[0.08] px-3 py-2 text-xs text-danger"><span>저장 또는 불러오기 실패: {error}</span><button type="button" className="btn-secondary text-xs" onClick={() => void (loadedRef.current ? saveNow() : loadScratchpad())}>{loadedRef.current ? "저장 재시도" : "불러오기 재시도"}</button></div> : null}

      {sourceMode && requiresRawScratchpadEditing(content) ? (
        <div className="scratchpad-compat-notice" role="note">
          표·HTML 등 원본 보존이 필요한 내용이 있어 안전한 Markdown 원본 편집을 사용합니다.
          제목과 목록은 <strong>서식 미리보기</strong>에서 확인할 수 있으며, 원본은 변환하지 않습니다.
        </div>
      ) : null}
      {sourceMode && sourcePreview ? (
        <div className="scratchpad-source-preview min-h-0 flex-1 overflow-auto px-4 py-5 sm:px-8"
          role="region" aria-label="낙서장 Markdown 서식 미리보기">
          <MarkdownPreview value={content} className="scratchpad-rendered-preview mx-auto w-full max-w-[1080px] break-words" />
        </div>
      ) : sourceMode ? <textarea
        ref={editorRef}
        value={content}
        onChange={(event) => applyContent(event.target.value)}
        onKeyDown={handleEditorKeyDown}
        onSelect={(event) => setSelectionStart(event.currentTarget.selectionStart)}
        onClick={(event) => setSelectionStart(event.currentTarget.selectionStart)}
        spellCheck={false}
        wrap={wrap ? "soft" : "off"}
        disabled={Boolean(recoveryDraft) || saveState === "loading" || (!loadedRef.current && saveState === "error")}
        className="min-h-0 flex-1 resize-none border-0 bg-ui-canvas px-4 py-5 font-mono leading-7 text-ui-text sm:px-8 outline-none selection:bg-accent-500/35 disabled:opacity-60"
        style={{ fontSize: `${Math.round(15 * zoom / 100)}px`, whiteSpace: wrap ? "pre-wrap" : "pre" }}
        placeholder="아무 내용이나 바로 작성하세요. 내용은 자동으로 저장됩니다."
        aria-label="낙서장 편집기"
      /> : <RichScratchpadEditor ref={richEditorRef} markdown={content} onChange={applyContent} readOnly={Boolean(recoveryDraft) || saveState === "loading" || (!loadedRef.current && saveState === "error")} zoom={zoom} wrap={wrap} onShortcut={handleEditorKeyDown} /> }

      <div className="flex shrink-0 items-center justify-between gap-3 border-t border-ui-divider bg-ui-canvas px-3 py-1.5 text-[11px] text-ui-muted">
        <div className="flex min-w-0 items-center gap-3">
          <span className={saveState === "error" ? "text-danger" : saveState === "saved" ? "text-ink-400" : "text-warning"}>{saveLabel}</span>
          <span className="hidden sm:inline">줄 {cursor.line}, 열 {cursor.column}</span>
          <span className="hidden md:inline">{content.length.toLocaleString()}자</span>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <button type="button" className="hover:text-ink-200" onClick={() => setZoom(100)}>{zoom}%</button>
          <span>{wrap ? "자동 줄 바꿈" : "줄 바꿈 없음"}</span>
          <span>UTF-8</span>
        </div>
      </div>

      <input ref={fileInputRef} type="file" className="hidden" accept=".txt,.md,text/plain,text/markdown" onChange={(event) => void openTextFile(event.target.files?.[0])} />
    </section>
  );
}
