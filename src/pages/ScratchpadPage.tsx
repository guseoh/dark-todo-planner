import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { api, jsonBody } from "../lib/api/client";

type ScratchpadResponse = {
  scratchpad: {
    content: string;
    updatedAt: string | null;
  };
};

type SaveState = "loading" | "saved" | "dirty" | "saving" | "error";

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
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const historyRef = useRef<string[]>([""]);
  const historyIndexRef = useRef(0);
  const loadedRef = useRef(false);

  const [content, setContent] = useState("");
  const [savedContent, setSavedContent] = useState("");
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("loading");
  const [error, setError] = useState("");
  const [wrap, setWrap] = useState(readWrap);
  const [zoom, setZoom] = useState(readZoom);
  const [selectionStart, setSelectionStart] = useState(0);
  const [findOpen, setFindOpen] = useState(false);
  const [replaceOpen, setReplaceOpen] = useState(false);
  const [findText, setFindText] = useState("");
  const [replaceText, setReplaceText] = useState("");

  const resetHistory = useCallback((value: string) => {
    historyRef.current = [value];
    historyIndexRef.current = 0;
  }, []);

  const applyContent = useCallback((next: string, recordHistory = true) => {
    setContent(next);
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
      setContent(next);
      setSavedContent(next);
      setUpdatedAt(result.scratchpad.updatedAt);
      resetHistory(next);
      loadedRef.current = true;
      setSaveState("saved");
      setError("");
    } catch (err) {
      setSaveState("error");
      setError(err instanceof Error ? err.message : "낙서장을 불러오지 못했습니다.");
    }
  }, [resetHistory]);

  const saveNow = useCallback(async (value = content) => {
    if (!loadedRef.current) return false;
    setSaveState("saving");
    try {
      const result = await api<ScratchpadResponse>("/api/scratchpad", {
        method: "PUT",
        ...jsonBody({ content: value }),
      });
      setSavedContent(result.scratchpad.content);
      setUpdatedAt(result.scratchpad.updatedAt);
      setSaveState(result.scratchpad.content === value ? "saved" : "dirty");
      setError("");
      return true;
    } catch (err) {
      setSaveState("error");
      setError(err instanceof Error ? err.message : "낙서장을 저장하지 못했습니다.");
      return false;
    }
  }, [content]);

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

  const selection = () => {
    const editor = editorRef.current;
    if (!editor) return { start: 0, end: 0, text: "" };
    return { start: editor.selectionStart, end: editor.selectionEnd, text: content.slice(editor.selectionStart, editor.selectionEnd) };
  };

  const replaceSelection = (before: string, after = before, fallback = "텍스트") => {
    const { start, end, text } = selection();
    const chosen = text || fallback;
    const next = `${content.slice(0, start)}${before}${chosen}${after}${content.slice(end)}`;
    applyContent(next);
    restoreSelection(start + before.length, start + before.length + chosen.length);
  };

  const prefixSelectedLines = (prefix: string) => {
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
    if (historyIndexRef.current <= 0) return;
    historyIndexRef.current -= 1;
    const next = historyRef.current[historyIndexRef.current];
    setContent(next);
    restoreSelection(next.length);
  };

  const redo = () => {
    if (historyIndexRef.current >= historyRef.current.length - 1) return;
    historyIndexRef.current += 1;
    const next = historyRef.current[historyIndexRef.current];
    setContent(next);
    restoreSelection(next.length);
  };

  const findNext = useCallback(() => {
    const keyword = findText.trim();
    const editor = editorRef.current;
    if (!keyword || !editor) return;
    const haystack = content.toLocaleLowerCase("ko");
    const needle = keyword.toLocaleLowerCase("ko");
    const from = Math.max(editor.selectionEnd, 0);
    let index = haystack.indexOf(needle, from);
    if (index === -1 && from > 0) index = haystack.indexOf(needle, 0);
    if (index === -1) return;
    restoreSelection(index, index + keyword.length);
  }, [content, findText, restoreSelection]);

  const replaceOne = () => {
    const keyword = findText.trim();
    if (!keyword) return;
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
    const regex = new RegExp(escapeRegExp(keyword), "gi");
    const next = content.replace(regex, replaceText);
    if (next === content) return;
    applyContent(next);
    restoreSelection(0);
  };

  const newDocument = () => {
    if (content.trim() && content !== savedContent && !window.confirm("저장되지 않은 내용이 있습니다. 새 낙서장으로 비울까요?")) return;
    applyContent("");
    restoreSelection(0);
  };

  const openTextFile = async (file?: File) => {
    if (!file) return;
    const text = await file.text();
    applyContent(text);
    restoreSelection(0);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const downloadText = () => {
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `scratchpad-${new Date().toISOString().slice(0, 10)}.txt`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const handleEditorKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
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
  const toolButtonClass = "flex h-8 min-w-8 items-center justify-center rounded border border-transparent px-2 text-xs font-semibold text-ink-300 hover:border-ink-700 hover:bg-ink-800 hover:text-ink-100";

  return (
    <div className="mx-auto flex min-h-[calc(100vh-6.5rem)] w-full max-w-[1500px] flex-col overflow-hidden rounded-lg border border-ink-700/70 bg-ink-950 shadow-2xl">
      <div className="flex shrink-0 items-center justify-between border-b border-ink-700/70 bg-ink-900 px-2 py-1">
        <div className="flex items-center gap-0.5">
          <details className="relative">
            <summary className={`${menuButtonClass} cursor-pointer list-none`}>파일</summary>
            <div className="absolute left-0 top-full z-40 mt-1 w-44 rounded-md border border-ink-700 bg-ink-900 p-1 shadow-xl">
              <button type="button" className="w-full rounded px-3 py-2 text-left text-xs text-ink-200 hover:bg-ink-800" onClick={newDocument}>새 문서</button>
              <button type="button" className="w-full rounded px-3 py-2 text-left text-xs text-ink-200 hover:bg-ink-800" onClick={() => fileInputRef.current?.click()}>텍스트 파일 열기</button>
              <button type="button" className="w-full rounded px-3 py-2 text-left text-xs text-ink-200 hover:bg-ink-800" onClick={() => void saveNow(content)}>저장 <span className="float-right text-ink-500">Ctrl+S</span></button>
              <button type="button" className="w-full rounded px-3 py-2 text-left text-xs text-ink-200 hover:bg-ink-800" onClick={downloadText}>텍스트로 다운로드</button>
            </div>
          </details>
          <details className="relative">
            <summary className={`${menuButtonClass} cursor-pointer list-none`}>편집</summary>
            <div className="absolute left-0 top-full z-40 mt-1 w-44 rounded-md border border-ink-700 bg-ink-900 p-1 shadow-xl">
              <button type="button" className="w-full rounded px-3 py-2 text-left text-xs text-ink-200 hover:bg-ink-800" onClick={undo}>실행 취소 <span className="float-right text-ink-500">Ctrl+Z</span></button>
              <button type="button" className="w-full rounded px-3 py-2 text-left text-xs text-ink-200 hover:bg-ink-800" onClick={redo}>다시 실행 <span className="float-right text-ink-500">Ctrl+Y</span></button>
              <div className="my-1 border-t border-ink-700" />
              <button type="button" className="w-full rounded px-3 py-2 text-left text-xs text-ink-200 hover:bg-ink-800" onClick={() => { setFindOpen(true); setReplaceOpen(false); }}>찾기 <span className="float-right text-ink-500">Ctrl+F</span></button>
              <button type="button" className="w-full rounded px-3 py-2 text-left text-xs text-ink-200 hover:bg-ink-800" onClick={() => { setFindOpen(true); setReplaceOpen(true); }}>바꾸기 <span className="float-right text-ink-500">Ctrl+H</span></button>
              <button type="button" className="w-full rounded px-3 py-2 text-left text-xs text-ink-200 hover:bg-ink-800" onClick={() => { editorRef.current?.focus(); editorRef.current?.select(); }}>전체 선택</button>
            </div>
          </details>
          <details className="relative">
            <summary className={`${menuButtonClass} cursor-pointer list-none`}>서식</summary>
            <div className="absolute left-0 top-full z-40 mt-1 w-48 rounded-md border border-ink-700 bg-ink-900 p-1 shadow-xl">
              <button type="button" className="w-full rounded px-3 py-2 text-left text-xs text-ink-200 hover:bg-ink-800" onClick={() => prefixSelectedLines("# ")}>제목 H1</button>
              <button type="button" className="w-full rounded px-3 py-2 text-left text-xs text-ink-200 hover:bg-ink-800" onClick={() => prefixSelectedLines("- ")}>글머리 목록</button>
              <button type="button" className="w-full rounded px-3 py-2 text-left text-xs text-ink-200 hover:bg-ink-800" onClick={() => replaceSelection("**", "**")}>굵게</button>
              <button type="button" className="w-full rounded px-3 py-2 text-left text-xs text-ink-200 hover:bg-ink-800" onClick={() => replaceSelection("_", "_")}>기울임</button>
              <button type="button" className="w-full rounded px-3 py-2 text-left text-xs text-ink-200 hover:bg-ink-800" onClick={() => replaceSelection("~~", "~~")}>취소선</button>
              <button type="button" className="w-full rounded px-3 py-2 text-left text-xs text-ink-200 hover:bg-ink-800" onClick={() => replaceSelection("[", "](https://)", "링크")}>링크</button>
            </div>
          </details>
          <details className="relative">
            <summary className={`${menuButtonClass} cursor-pointer list-none`}>보기</summary>
            <div className="absolute left-0 top-full z-40 mt-1 w-44 rounded-md border border-ink-700 bg-ink-900 p-1 shadow-xl">
              <button type="button" className="w-full rounded px-3 py-2 text-left text-xs text-ink-200 hover:bg-ink-800" onClick={() => setWrap((value) => !value)}>자동 줄 바꿈 <span className="float-right">{wrap ? "✓" : ""}</span></button>
              <button type="button" className="w-full rounded px-3 py-2 text-left text-xs text-ink-200 hover:bg-ink-800" onClick={() => setZoom((value) => Math.min(MAX_ZOOM, value + ZOOM_STEP))}>확대</button>
              <button type="button" className="w-full rounded px-3 py-2 text-left text-xs text-ink-200 hover:bg-ink-800" onClick={() => setZoom((value) => Math.max(MIN_ZOOM, value - ZOOM_STEP))}>축소</button>
              <button type="button" className="w-full rounded px-3 py-2 text-left text-xs text-ink-200 hover:bg-ink-800" onClick={() => setZoom(100)}>100%</button>
            </div>
          </details>
        </div>
        <div className="flex items-center gap-2 px-2 text-[11px] text-ink-500">
          <span>{saveLabel}</span>
          {lastSavedLabel && saveState === "saved" ? <span>{lastSavedLabel}</span> : null}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1 border-b border-ink-700/70 bg-ink-900/80 px-2 py-1.5">
        <button type="button" className={toolButtonClass} title="제목 H1" onClick={() => prefixSelectedLines("# ")}>H1</button>
        <button type="button" className={toolButtonClass} title="글머리 목록" onClick={() => prefixSelectedLines("- ")}>• 목록</button>
        <span className="mx-1 h-5 w-px bg-ink-700" />
        <button type="button" className={`${toolButtonClass} text-sm font-black`} title="굵게" onClick={() => replaceSelection("**", "**")}>B</button>
        <button type="button" className={`${toolButtonClass} text-sm italic`} title="기울임" onClick={() => replaceSelection("_", "_")}>I</button>
        <button type="button" className={`${toolButtonClass} text-sm line-through`} title="취소선" onClick={() => replaceSelection("~~", "~~")}>S</button>
        <button type="button" className={toolButtonClass} title="링크" onClick={() => replaceSelection("[", "](https://)", "링크")}>링크</button>
        <span className="ml-auto hidden text-[10px] text-ink-600 sm:block">가벼운 서식은 Markdown 문법으로 저장됩니다.</span>
      </div>

      {findOpen ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-ink-700/70 bg-ink-900 px-3 py-2">
          <input autoFocus className="field min-h-8 w-48 py-1 text-xs" value={findText} onChange={(event) => setFindText(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); findNext(); } }} placeholder="찾을 내용" />
          {replaceOpen ? <input className="field min-h-8 w-48 py-1 text-xs" value={replaceText} onChange={(event) => setReplaceText(event.target.value)} placeholder="바꿀 내용" /> : null}
          <button type="button" className="btn-secondary min-h-8 px-2 py-1 text-xs" onClick={findNext}>다음 찾기</button>
          {replaceOpen ? <button type="button" className="btn-secondary min-h-8 px-2 py-1 text-xs" onClick={replaceOne}>바꾸기</button> : null}
          {replaceOpen ? <button type="button" className="btn-secondary min-h-8 px-2 py-1 text-xs" onClick={replaceAll}>모두 바꾸기</button> : null}
          <button type="button" className="ml-auto min-h-8 rounded px-2 text-xs text-ink-500 hover:bg-ink-800 hover:text-ink-200" onClick={() => { setFindOpen(false); setReplaceOpen(false); editorRef.current?.focus(); }}>닫기</button>
        </div>
      ) : null}

      {error ? <div className="shrink-0 border-b border-danger/30 bg-danger/[0.08] px-3 py-2 text-xs text-red-100">{error}</div> : null}

      <textarea
        ref={editorRef}
        value={content}
        onChange={(event) => applyContent(event.target.value)}
        onKeyDown={handleEditorKeyDown}
        onSelect={(event) => setSelectionStart(event.currentTarget.selectionStart)}
        onClick={(event) => setSelectionStart(event.currentTarget.selectionStart)}
        spellCheck={false}
        wrap={wrap ? "soft" : "off"}
        disabled={saveState === "loading"}
        className="min-h-0 flex-1 resize-none border-0 bg-[#202020] px-5 py-4 font-mono leading-7 text-ink-100 outline-none selection:bg-accent-500/35 disabled:opacity-60"
        style={{ fontSize: `${Math.round(15 * zoom / 100)}px`, whiteSpace: wrap ? "pre-wrap" : "pre" }}
        placeholder="아무 내용이나 바로 작성하세요. 내용은 자동으로 저장됩니다."
        aria-label="낙서장 편집기"
      />

      <div className="flex shrink-0 items-center justify-between gap-3 border-t border-ink-700/70 bg-ink-900 px-3 py-1.5 text-[10px] text-ink-500">
        <div className="flex min-w-0 items-center gap-3">
          <span className={saveState === "error" ? "text-red-200" : saveState === "saved" ? "text-ink-400" : "text-amber-200"}>{saveLabel}</span>
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
    </div>
  );
}
