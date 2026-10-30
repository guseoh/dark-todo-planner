import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import { StarterKit } from "@tiptap/starter-kit";
import { TaskItem, TaskList } from "@tiptap/extension-list";
import { Markdown } from "@tiptap/markdown";
import type { Editor } from "@tiptap/core";

export type RichAction = "h1" | "h2" | "bullet" | "ordered" | "task" | "quote" | "bold" | "italic" | "strike" | "code" | "link";

export type RichScratchpadHandle = {
  focus: () => void;
  selectAll: () => void;
  action: (action: RichAction) => void;
  undo: () => void;
  redo: () => void;
  findNext: (query: string) => boolean;
  replaceOne: (query: string, value: string) => boolean;
  replaceAll: (query: string, value: string) => number;
};

type Match = { from: number; to: number };
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

export const RichScratchpadEditor = forwardRef<RichScratchpadHandle, {
  markdown: string;
  onChange: (markdown: string) => void;
  readOnly: boolean;
  zoom: number;
  wrap: boolean;
  onShortcut: (event: React.KeyboardEvent<HTMLDivElement>) => void;
}>(function RichScratchpadEditor({ markdown, onChange, readOnly, zoom, wrap, onShortcut }, ref) {
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ link: { openOnClick: false, autolink: false } }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Markdown,
    ],
    content: markdown,
    contentType: "markdown",
    editable: !readOnly,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        role: "textbox", "aria-label": "낙서장 편집기",
        "aria-multiline": "true", spellcheck: "false",
        class: "scratchpad-prosemirror min-h-[45vh] outline-none",
      },
    },
    onUpdate: ({ editor: changed }) => onChangeRef.current(changed.getMarkdown()),
  });

  useEffect(() => {
    if (!editor) return;
    if (markdown !== editor.getMarkdown()) {
      editor.commands.setContent(markdown, { contentType: "markdown", emitUpdate: false });
    }
  }, [editor, markdown]);
  useEffect(() => { editor?.setEditable(!readOnly); }, [editor, readOnly]);

  useImperativeHandle(ref, () => ({
    focus: () => { editor?.commands.focus(); },
    selectAll: () => { editor?.chain().focus().selectAll().run(); },
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
    <div className="scratchpad-rich flex-1 min-h-0 overflow-auto bg-ui-canvas px-4 py-5 text-ui-text sm:px-8"
      onKeyDown={onShortcut} style={{ fontSize: String(15 * zoom / 100) + "px", overflowWrap: wrap ? "anywhere" : "normal" }}>
      <EditorContent editor={editor} />
    </div>
  );
});
