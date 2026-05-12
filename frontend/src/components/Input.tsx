// SPDX-License-Identifier: AGPL-3.0-or-later
import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, invalid, ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(
        "h-9 w-full rounded-(--radius-md) px-3 text-sm",
        "bg-(--color-bg-surface) text-(--color-fg-primary) placeholder:text-(--color-fg-subtle)",
        "border border-(--color-border-default)",
        "transition-[border-color,box-shadow] duration-(--duration-fast)",
        "hover:border-(--color-border-strong)",
        "focus:border-(--color-accent) focus:outline-none focus:ring-2 focus:ring-(--color-accent)/30",
        "disabled:opacity-60 disabled:cursor-not-allowed",
        invalid &&
          "border-(--color-state-danger) focus:border-(--color-state-danger) focus:ring-(--color-state-danger)/30",
        className,
      )}
      {...props}
    />
  );
});
