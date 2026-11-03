"use client";
import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";
const focusable =
  'button:not(:disabled),a[href],input:not(:disabled),textarea:not(:disabled),select:not(:disabled),iframe,[tabindex="0"]';
/** Shared modal lifecycle: focus trapping/restoration, scroll lock, Escape and backdrop dismissal. */
export function Modal({
  titleId,
  onClose,
  busy = false,
  className,
  overlayClassName,
  children,
}: {
  titleId: string;
  onClose: () => void;
  busy?: boolean;
  className?: string;
  overlayClassName?: string;
  children: ReactNode;
}) {
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const target =
      panel.current?.querySelector<HTMLElement>("[autofocus]") ||
      panel.current?.querySelector<HTMLElement>(focusable) ||
      panel.current;
    target?.focus();
    return () => {
      document.body.style.overflow = overflow;
      if (previous instanceof HTMLElement && previous.isConnected)
        previous.focus();
    };
  }, []);
  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex items-center justify-center bg-[#14231b]/30 p-5 backdrop-blur-sm",
        overlayClassName,
      )}
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          e.stopPropagation();
          if (!busy) onClose();
        }
        if (e.key === "Tab") {
          const nodes = Array.from(
            panel.current?.querySelectorAll<HTMLElement>(focusable) || [],
          );
          const first = nodes[0];
          const last = nodes.at(-1);
          if (!first) {
            e.preventDefault();
            panel.current?.focus();
          } else if (
            e.shiftKey &&
            (document.activeElement === first ||
              document.activeElement === panel.current)
          ) {
            e.preventDefault();
            last?.focus();
          } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }}
    >
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cn("panel w-full max-w-md p-6 shadow-xl", className)}
      >
        {children}
      </div>
    </div>
  );
}
