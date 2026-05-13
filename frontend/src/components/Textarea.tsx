// SPDX-License-Identifier: AGPL-3.0-or-later
import { type ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Textarea — same look-and-feel as Input, optimised for multi-line
 * input (proposal reasons, person notes, etc).
 */
export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
  label?: ReactNode;
}

export function Textarea({
  invalid,
  className,
  label,
  ...rest
}: TextareaProps) {
  const inner = (
    <textarea
      className={cn(
        "w-full rounded-(--radius-md) px-2.5 py-2 text-sm",
        "bg-(--color-bg-surface) text-(--color-fg-primary)",
        "border border-(--color-border-default)",
        "transition-[border-color,box-shadow] duration-(--duration-fast)",
        "focus:outline-none focus:ring-2 focus:border-(--color-accent) focus:ring-(--color-accent)/30",
        invalid && "border-(--color-state-danger) focus:ring-(--color-state-danger)/30",
        className,
      )}
      {...rest}
    />
  );
  if (!label) return inner;
  return (
    <label className="block space-y-1">
      <span className="text-xs font-medium text-(--color-fg-secondary)">{label}</span>
      {inner}
    </label>
  );
}
