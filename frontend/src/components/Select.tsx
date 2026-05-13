// SPDX-License-Identifier: AGPL-3.0-or-later
import { forwardRef, type SelectHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  invalid?: boolean;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { className, invalid, children, ...rest },
  ref,
) {
  return (
    <select
      ref={ref}
      className={cn(
        "h-9 w-full rounded-(--radius-md) px-2.5 pr-8 text-sm",
        "bg-(--color-bg-surface) text-(--color-fg-primary)",
        "border border-(--color-border-default)",
        "appearance-none bg-no-repeat bg-[length:1rem] bg-[right_0.5rem_center]",
        "transition-[border-color,box-shadow] duration-(--duration-fast)",
        "focus:outline-none focus:ring-2 focus:border-(--color-accent) focus:ring-(--color-accent)/30",
        invalid && "border-(--color-state-danger) focus:ring-(--color-state-danger)/30",
        className,
      )}
      {...rest}
    >
      {children}
    </select>
  );
});
