import { forwardRef, KeyboardEvent, TextareaHTMLAttributes, useImperativeHandle, useRef } from "react";
import { applyAutoListEnter } from "../../lib/editor/autoList";

type SmartTextareaProps = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "value" | "onChange"> & {
  value: string;
  onChange: (value: string) => void;
};

export const SmartTextarea = forwardRef<HTMLTextAreaElement, SmartTextareaProps>(({ value, onChange, onKeyDown, ...props }, forwardedRef) => {
  const ref = useRef<HTMLTextAreaElement | null>(null);
  useImperativeHandle(forwardedRef, () => ref.current as HTMLTextAreaElement);

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    onKeyDown?.(event);
    if (event.defaultPrevented || event.key !== "Enter" || event.shiftKey || event.metaKey || event.ctrlKey || event.altKey) return;

    const textarea = ref.current;
    if (!textarea) return;
    const result = applyAutoListEnter(value, textarea.selectionStart, textarea.selectionEnd);
    if (!result) return;

    event.preventDefault();
    onChange(result.value);
    window.requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(result.cursor, result.cursor);
    });
  };

  return <textarea ref={ref} value={value} onChange={(event) => onChange(event.target.value)} onKeyDown={handleKeyDown} {...props} />;
});

SmartTextarea.displayName = "SmartTextarea";
