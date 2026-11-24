/** App-local shortcut. Text editors retain their native Ctrl+B formatting. */
export function isSidebarToggleShortcut(event: Pick<KeyboardEvent, "key" | "ctrlKey" | "metaKey" | "shiftKey" | "altKey" | "repeat" | "isComposing" | "defaultPrevented">, editing: boolean): boolean {
  return !editing && !event.defaultPrevented && !event.isComposing && !event.repeat
    && event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey && event.key.toLowerCase() === "b";
}
