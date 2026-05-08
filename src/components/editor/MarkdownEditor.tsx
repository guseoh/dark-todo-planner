import { TextareaHTMLAttributes, useRef } from "react";
import { Bold, CheckSquare, Code2, Italic, Link, List, ListOrdered, Quote, Strikethrough } from "lucide-react";
import { SmartTextarea } from "./SmartTextarea";

type MarkdownEditorProps = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "value" | "onChange"> & {
  value: string;
  onChange: (value: string) => void;
  label?: string;
};

type ToolbarAction =
  | "bold"
  | "italic"
  | "strike"
  | "bullet"
  | "number"
  | "check"
  | "quote"
  | "code"
  | "link";

const actions: Array<{ id: ToolbarAction; label: string; icon: typeof Bold }> = [
  { id: "bold", label: "굵게", icon: Bold },
  { id: "italic", label: "기울임", icon: Italic },
  { id: "strike", label: "취소선", icon: Strikethrough },
  { id: "bullet", label: "글머리", icon: List },
  { id: "number", label: "번호 목록", icon: ListOrdered },
  { id: "check", label: "체크리스트", icon: CheckSquare },
  { id: "quote", label: "인용", icon: Quote },
  { id: "code", label: "코드", icon: Code2 },
  { id: "link", label: "링크", icon: Link },
];

const linePrefix: Partial<Record<ToolbarAction, string>> = {
  bullet: "- ",
  number: "1. ",
  check: "- [ ] ",
  quote: "> ",
};

const wrapSelection = (action: ToolbarAction, selected: string) => {
  if (action === "bold") return `**${selected || "굵은 글씨"}**`;
  if (action === "italic") return `_${selected || "기울임"}_`;
  if (action === "strike") return `~~${selected || "취소선"}~~`;
  if (action === "code") return `\`${selected || "code"}\``;
  if (action === "link") return `[${selected || "링크 텍스트"}](https://)`;
  return selected;
};

export function MarkdownEditor({ value, onChange, label, className = "", ...props }: MarkdownEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const applyAction = (action: ToolbarAction) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = value.slice(start, end);
    const prefix = linePrefix[action];
    const nextText = prefix
      ? selected
          .split("\n")
          .map((line) => `${prefix}${line}`)
          .join("\n")
      : wrapSelection(action, selected);
    const nextValue = `${value.slice(0, start)}${nextText}${value.slice(end)}`;
    onChange(nextValue);
    window.requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(start + nextText.length, start + nextText.length);
    });
  };

  return (
    <div className={className}>
      {label ? <p className="mb-1 text-xs font-semibold text-ink-400">{label}</p> : null}
      <div className="rounded-lg border border-ink-700 bg-ink-950/55 focus-within:border-accent-500 focus-within:ring-2 focus-within:ring-accent-500/25">
        <div className="flex flex-wrap gap-1 border-b border-ink-800 px-2 py-1.5">
          {actions.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.id}
                type="button"
                className="inline-flex h-7 w-7 items-center justify-center rounded-md text-ink-400 transition hover:bg-ink-800 hover:text-ink-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/40"
                onClick={() => applyAction(action.id)}
                aria-label={action.label}
                title={action.label}
              >
                <Icon size={14} />
              </button>
            );
          })}
        </div>
        <SmartTextarea
          ref={textareaRef}
          className="min-h-20 w-full resize-y rounded-b-lg bg-transparent px-3 py-2 text-sm leading-6 text-ink-100 outline-none placeholder:text-ink-500"
          value={value}
          onChange={onChange}
          {...props}
        />
      </div>
    </div>
  );
}
