import { useEffect, useId, useRef } from "react";
import type { ReactNode } from "react";
import { X } from "lucide-react";

type ModalProps = {
  title: string;
  description?: string;
  children: ReactNode;
  onClose: () => void;
  size?: "md" | "lg";
};

const focusableSelector = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[contenteditable='true']",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

const modalStack: symbol[] = [];
let bodyOverflowBeforeModal: string | null = null;

const isVisible = (element: HTMLElement) =>
  element.getClientRects().length > 0 && element.getAttribute("aria-hidden") !== "true";

const getVisibleFocusableElements = (container: HTMLElement) =>
  Array.from(container.querySelectorAll<HTMLElement>(focusableSelector)).filter(isVisible);

export function Modal({ title, description, children, onClose, size = "md" }: ModalProps) {
  const sizeClass = size === "lg" ? "max-w-3xl" : "max-w-xl";
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const onCloseRef = useRef(onClose);
  const modalTokenRef = useRef(Symbol("modal"));
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return undefined;

    const modalToken = modalTokenRef.current;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (modalStack.length === 0) {
      bodyOverflowBeforeModal = document.body.style.overflow;
      document.body.style.overflow = "hidden";
    }
    modalStack.push(modalToken);

    const meaningfulInput = Array.from(dialog.querySelectorAll<HTMLElement>(
      "[data-modal-initial-focus], input:not([disabled]):not([type='hidden']), select:not([disabled]), textarea:not([disabled]), [contenteditable='true']",
    )).find(isVisible);
    (meaningfulInput || closeButtonRef.current || dialog).focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (modalStack[modalStack.length - 1] !== modalToken) return;

      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onCloseRef.current();
        return;
      }

      if (event.key !== "Tab") return;
      const focusableElements = getVisibleFocusableElements(dialog);
      if (!focusableElements.length) {
        event.preventDefault();
        dialog.focus();
        return;
      }

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];
      const activeElement = document.activeElement;
      if (event.shiftKey && (activeElement === firstElement || !dialog.contains(activeElement))) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && (activeElement === lastElement || !dialog.contains(activeElement))) {
        event.preventDefault();
        firstElement.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      const wasTopModal = modalStack[modalStack.length - 1] === modalToken;
      const modalIndex = modalStack.lastIndexOf(modalToken);
      if (modalIndex >= 0) modalStack.splice(modalIndex, 1);

      if (modalStack.length === 0) {
        document.body.style.overflow = bodyOverflowBeforeModal || "";
        bodyOverflowBeforeModal = null;
      }
      if (wasTopModal && opener?.isConnected) opener.focus();
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center overflow-y-auto bg-black/70 px-3 py-4 backdrop-blur-sm sm:px-4">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        className={`flex max-h-[calc(100vh-2rem)] w-full ${sizeClass} flex-col overflow-hidden rounded-lg border border-ink-700/70 bg-ink-900 shadow-soft outline-none`}
      >
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-ink-700/60 px-4 py-3">
          <div className="min-w-0">
            <h2 id={titleId} className="text-base font-bold text-ink-100 sm:text-lg">{title}</h2>
            {description ? <p id={descriptionId} className="mt-1 text-xs leading-5 text-ink-400 sm:text-sm">{description}</p> : null}
          </div>
          <button ref={closeButtonRef} type="button" className="icon-btn h-8 w-8 shrink-0" onClick={onClose} aria-label={`${title} 닫기`}>
            <X size={15} />
          </button>
        </div>
        <div className="min-h-0 overflow-y-auto px-4 py-4">{children}</div>
      </div>
    </div>
  );
}
