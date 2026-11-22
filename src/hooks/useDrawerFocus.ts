import { useEffect, type RefObject } from "react";

const focusable = "a[href], button, input, select, textarea, summary, [contenteditable='true'], [tabindex]";

export function useDrawerFocus(open: boolean, panelRef: RefObject<HTMLElement>) {
  useEffect(() => {
    const panel = panelRef.current;
    if (!open || !panel) return;

    const opener = document.activeElement;
    if (!panel.contains(opener)) panel.focus();

    const trapTab = (event: KeyboardEvent) => {
      if (event.key !== "Tab" || event.defaultPrevented || getComputedStyle(panel).position !== "fixed") return;
      if (document.activeElement?.closest('[aria-modal="true"]')) return;

      const controls = Array.from(panel.querySelectorAll<HTMLElement>(focusable))
        .filter((control) => control.tabIndex >= 0 && !control.matches(":disabled") && control.getClientRects().length > 0);
      const current = document.activeElement;
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (!first || current === panel || !panel.contains(current) ||
        (event.shiftKey ? current === first : current === last)) {
        event.preventDefault();
        ((event.shiftKey ? last : first) ?? panel).focus();
      }
    };

    window.addEventListener("keydown", trapTab);
    return () => {
      window.removeEventListener("keydown", trapTab);
      if (opener instanceof HTMLElement && opener.isConnected &&
        (document.activeElement === document.body || panel.contains(document.activeElement))) {
        opener.focus();
      }
    };
  }, [open, panelRef]);
}
