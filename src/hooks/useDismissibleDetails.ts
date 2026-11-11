import { useEffect, type RefObject } from "react";

/**
 * Closes a native <details> popover when the user clicks/taps outside it,
 * presses Escape, or when `resetKey` changes (e.g. the active view).
 */
export function useDismissibleDetails(ref: RefObject<HTMLDetailsElement | null>, resetKey?: unknown) {
  useEffect(() => {
    const close = (restoreFocus: boolean) => {
      const element = ref.current;
      if (!element?.open) return;
      element.open = false;
      if (restoreFocus) element.querySelector<HTMLElement>("summary")?.focus();
    };
    const onPointerDown = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) close(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && ref.current?.open) close(ref.current.contains(document.activeElement));
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [ref]);

  useEffect(() => {
    if (ref.current) ref.current.open = false;
  }, [ref, resetKey]);
}
