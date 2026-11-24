import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import { StarterKit } from "@tiptap/starter-kit";
import { TaskItem, TaskList } from "@tiptap/extension-list";
import { Markdown } from "@tiptap/markdown";
import type { Editor } from "@tiptap/core";

export type RichAction = "h1" | "h2" | "bullet" | "ordered" | "task" | "quote" | "bold" | "italic" | "strike" | "code" | "link";

export type RichMarkdownHandle = {
  focus: () => void;
  selectAll: () => void;
  selectedText: () => string;
  action: (action: RichAction) => void;
  undo: () => void;
  redo: () => void;
  findNext: (query: string) => boolean;
  replaceOne: (query: string, value: string) => boolean;
  replaceAll: (query: string, value: string) => number;
};

// Keep immutable Tiptap extension configurations stable across editor instances.
// Rebuilding these on every memo selection adds avoidable work to the main thread.
const markdownExtensions = [
  StarterKit.configure({ link: { openOnClick: false, autolink: false } }),
  TaskList,
  TaskItem.configure({ nested: true }),
  Markdown,
];

type Match = { from: number; to: number };
type EditorPosition = Match & { markdown: string; scrollTop: number };
const positions = new Map<string, EditorPosition>();
function rememberPosition(key: string, position: EditorPosition) {
  positions.delete(key);
  positions.set(key, position);
  if (positions.size > 30) positions.delete(positions.keys().next().value!);
}
const locate = (editor: Editor, query: string): Match[] => {
  if (!query) return [];
  const matches: Match[] = [];
  const needle = query.toLocaleLowerCase("ko");
  editor.state.doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return;
    const text = node.text.toLocaleLowerCase("ko");
    let offset = 0;
    while ((offset = text.indexOf(needle, offset)) >= 0) {
      matches.push({ from: pos + offset, to: pos + offset + query.length });
      offset += Math.max(query.length, 1);
    }
  });
  return matches;
};

export const RichMarkdownEditor = forwardRef<RichMarkdownHandle, {
  markdown: string;
  onChange: (markdown: string) => void;
  readOnly?: boolean;
  zoom?: number;
  wrap?: boolean;
  onShortcut?: (event: React.KeyboardEvent<HTMLDivElement>) => void;
  variant?: "memo" | "scratchpad";
  positionKey?: string;
}>(function RichMarkdownEditor({ markdown, onChange, readOnly = false, zoom = 100, wrap = true, onShortcut, variant = "scratchpad", positionKey }, ref) {
  const onChangeRef = useRef(onChange);
  const lastEmittedRef = useRef<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const positionRef = useRef<EditorPosition | null>(positionKey ? positions.get(positionKey) ?? null : null);
  onChangeRef.current = onChange;
  const editor = useEditor({
    extensions: markdownExtensions,
    content: markdown,
    contentType: "markdown",
    editable: !readOnly,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        role: "textbox", "aria-label": variant === "memo" ? "메모 시각 편집기" : "낙서장 편집기",
        "aria-multiline": "true", spellcheck: "false",
        class: "scratchpad-prosemirror outline-none",
      },
    },
    onUpdate: ({ editor: changed }) => {
      const next = changed.getMarkdown();
      lastEmittedRef.current = next;
      onChangeRef.current(next);
    },
  });

  useEffect(() => {
    if (!editor) return;
    // Do not reset selection when React echoes the last editor update.
    if (markdown === lastEmittedRef.current) return;
    if (markdown !== editor.getMarkdown()) {
      editor.commands.setContent(markdown, { contentType: "markdown", emitUpdate: false });
    }
  }, [editor, markdown]);
  useEffect(() => { editor?.setEditable(!readOnly); }, [editor, readOnly]);

  // Position is session-local and bounded. Never restore offsets into changed content.
  useEffect(() => {
    if (!editor || !positionKey) return;
    const node = containerRef.current;
    const saved = positionRef.current;
    const frame = window.requestAnimationFrame(() => {
      if (saved && saved.markdown === editor.getMarkdown() && !editor.isDestroyed) {
        const max = editor.state.doc.content.size;
        if (saved.from >= 0 && saved.to <= max && saved.from <= saved.to) {
          editor.commands.setTextSelection({ from: saved.from, to: saved.to });
          if (node) node.scrollTop = saved.scrollTop;
        }
      }
    });
    let currentMarkdown = editor.getMarkdown();
    const capture = () => {
      if (editor.isDestroyed) return;
      const { from, to } = editor.state.selection;
      const position = { from, to, markdown: currentMarkdown, scrollTop: node?.scrollTop ?? 0 };
      positionRef.current = position;
      rememberPosition(positionKey, position);
    };
    const update = () => { currentMarkdown = editor.getMarkdown(); capture(); };
    editor.on("update", update);
    editor.on("selectionUpdate", capture);
    node?.addEventListener("scroll", capture, { passive: true });
    return () => {
      window.cancelAnimationFrame(frame);
      editor.off("update", update);
      editor.off("selectionUpdate", capture);
      node?.removeEventListener("scroll", capture);
    };
  }, [editor, positionKey]);

  useImperativeHandle(ref, () => ({
    focus: () => { editor?.commands.focus(); },
    selectAll: () => { editor?.chain().focus().selectAll().run(); },
    selectedText: () => editor ? editor.state.doc.textBetween(editor.state.selection.from, editor.state.selection.to, "\n") : "",
    action: (action) => {
      if (!editor) return;
      const chain = editor.chain().focus();
      switch (action) {
        case "h1": chain.toggleHeading({ level: 1 }).run(); break;
        case "h2": chain.toggleHeading({ level: 2 }).run(); break;
        case "bullet": chain.toggleBulletList().run(); break;
        case "ordered": chain.toggleOrderedList().run(); break;
        case "task": chain.toggleTaskList().run(); break;
        case "quote": chain.toggleBlockquote().run(); break;
        case "bold": chain.toggleBold().run(); break;
        case "italic": chain.toggleItalic().run(); break;
        case "strike": chain.toggleStrike().run(); break;
        case "code": chain.toggleCode().run(); break;
        case "link": {
          const current = editor.getAttributes("link").href as string | undefined;
          const value = window.prompt("https://로 시작하는 링크 주소", current || "https://");
          if (value === null) break;
          if (!value.trim()) { chain.unsetLink().run(); break; }
          try {
            const url = new URL(value);
            if (url.protocol !== "https:" && url.protocol !== "http:") break;
            chain.setLink({ href: url.toString() }).run();
          } catch { /* Invalid URL; do not inject unsafe links. */ }
          break;
        }
      }
    },
    undo: () => { editor?.chain().focus().undo().run(); },
    redo: () => { editor?.chain().focus().redo().run(); },
    findNext: (query) => {
      if (!editor) return false;
      const matches = locate(editor, query);
      if (!matches.length) return false;
      const after = editor.state.selection.to;
      const match = matches.find((item) => item.from >= after) || matches[0];
      editor.chain().focus().setTextSelection(match).run();
      return true;
    },
    replaceOne: (query, value) => {
      if (!editor || !query) return false;
      const { from, to } = editor.state.selection;
      const selected = editor.state.doc.textBetween(from, to);
      if (selected.toLocaleLowerCase("ko") !== query.toLocaleLowerCase("ko")) return false;
      const transaction = editor.state.tr.insertText(value, from, to);
      editor.view.dispatch(transaction);
      editor.commands.focus();
      return true;
    },
    replaceAll: (query, value) => {
      if (!editor || !query) return 0;
      const matches = locate(editor, query);
      if (!matches.length) return 0;
      const transaction = editor.state.tr;
      for (const match of matches.reverse()) transaction.insertText(value, match.from, match.to);
      editor.view.dispatch(transaction);
      return matches.length;
    },
  }), [editor]);

  return (
    <div ref={containerRef} className={`scratchpad-rich rich-markdown-editor rich-markdown-editor--${variant} min-h-0 overflow-auto bg-ui-canvas text-ui-text ${variant === "memo" ? "px-3 py-3" : "flex-1 px-4 py-5 sm:px-8"}`}
      onKeyDown={onShortcut} style={{ fontSize: String(16 * zoom / 100) + "px", overflowWrap: wrap ? "anywhere" : "normal" }}>
      <EditorContent editor={editor} />
    </div>
  );
});
