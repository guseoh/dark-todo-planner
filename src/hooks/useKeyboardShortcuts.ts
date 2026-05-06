import { useEffect } from "react";
import type { AppView } from "../components/layout/Sidebar";

const isTypingTarget = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) return false;
  const tagName = target.tagName.toLowerCase();
  return tagName === "input" || tagName === "textarea" || tagName === "select" || target.isContentEditable;
};

export function useKeyboardShortcuts({
  onChangeView,
  onFocusTodoInput,
}: {
  onChangeView: (view: AppView) => void;
  onFocusTodoInput: () => void;
}) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        document.dispatchEvent(new CustomEvent("planner:escape"));
        return;
      }

      if (isTypingTarget(event.target)) return;

      if (event.key.toLowerCase() === "n" && !event.ctrlKey && !event.metaKey) {
        event.preventDefault();
        onFocusTodoInput();
        return;
      }

      if (event.ctrlKey || event.metaKey || event.altKey) return;

      const key = event.key.toLowerCase();
      const viewMap: Partial<Record<string, AppView>> = {
        t: "today",
        w: "week",
        m: "month",
        a: "all",
        r: "reflection",
        g: "goals",
        f: "timer",
      };
      const nextView = viewMap[key];
      if (nextView) {
        event.preventDefault();
        onChangeView(nextView);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onChangeView, onFocusTodoInput]);
}
