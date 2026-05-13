// SPDX-License-Identifier: AGPL-3.0-or-later
import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Dialog — a centered modal built on the native <dialog> element
 * for accessibility (Esc to close, focus trap, inert backdrop).
 *
 * Controlled via the `open` prop. The caller is responsible for
 * dismissal — `onClose` fires on backdrop click, Esc, and the
 * built-in close button.
 */
export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  /** Width preset. md (default) ~ 28rem, lg ~ 36rem. */
  size?: "md" | "lg";
}

export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
}: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onCancel = (e: Event) => {
      e.preventDefault();
      onClose();
    };
    el.addEventListener("cancel", onCancel);
    return () => el.removeEventListener("cancel", onCancel);
  }, [onClose]);

  return (
    <dialog
      ref={ref}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className={cn(
        "p-0 m-auto",
        "bg-(--color-bg-surface) text-(--color-fg-primary)",
        "border border-(--color-border-default) rounded-(--radius-lg) shadow-(--shadow-3)",
        "backdrop:bg-black/40 backdrop:backdrop-blur-sm",
        "w-[calc(100vw-2rem)]",
        size === "lg" ? "max-w-xl" : "max-w-md",
      )}
      aria-labelledby="dialog-title"
      aria-describedby={description ? "dialog-desc" : undefined}
    >
      <div className="px-5 pt-4 pb-2">
        <h2 id="dialog-title" className="font-serif text-lg tracking-tight">
          {title}
        </h2>
        {description && (
          <p id="dialog-desc" className="mt-1 text-sm text-(--color-fg-secondary)">
            {description}
          </p>
        )}
      </div>
      <div className="px-5 py-3">{children}</div>
      {footer && (
        <div className="flex items-center justify-end gap-2 border-t border-(--color-border-subtle) bg-(--color-bg-sunken)/40 px-5 py-3">
          {footer}
        </div>
      )}
    </dialog>
  );
}
