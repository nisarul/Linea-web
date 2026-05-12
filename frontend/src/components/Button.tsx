// SPDX-License-Identifier: AGPL-3.0-or-later
import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

/**
 * Button — the workhorse interaction element.
 *
 * Variants:
 *   primary  — solid accent; the strongest call-to-action.
 *   secondary— bordered surface; the default for paired actions.
 *   ghost    — text-only; for inline / table-row actions.
 *   danger   — destructive (delete, ban, reject).
 *
 * Sizes:
 *   sm — dense (cockpit / table rows).
 *   md — default.
 *   lg — primary call-to-action on a marketing or empty state.
 */
export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
}

const base =
  "inline-flex items-center justify-center gap-1.5 font-medium " +
  "transition-[background,color,border-color,transform] duration-(--duration-fast) ease-(--ease-snap) " +
  "rounded-(--radius-md) select-none whitespace-nowrap " +
  "focus-visible:outline-none disabled:opacity-60 disabled:cursor-not-allowed " +
  "active:translate-y-px";

const variants: Record<ButtonVariant, string> = {
  primary:
    "bg-(--color-accent) text-(--color-fg-on-accent) " +
    "hover:bg-(--color-accent-hover) active:bg-(--color-accent-active)",
  secondary:
    "bg-(--color-bg-surface) text-(--color-fg-primary) " +
    "border border-(--color-border-default) " +
    "hover:bg-(--color-bg-sunken) active:border-(--color-border-strong)",
  ghost:
    "bg-transparent text-(--color-fg-secondary) " +
    "hover:bg-(--color-bg-sunken) hover:text-(--color-fg-primary)",
  danger:
    "bg-(--color-state-danger) text-(--color-fg-on-accent) " +
    "hover:opacity-90 active:opacity-80",
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-7 px-2.5 text-xs",
  md: "h-9 px-3.5 text-sm",
  lg: "h-11 px-5 text-base",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = "secondary",
    size = "md",
    isLoading = false,
    className,
    disabled,
    children,
    ...props
  },
  ref,
) {
  return (
    <button
      ref={ref}
      className={cn(base, variants[variant], sizes[size], className)}
      aria-busy={isLoading || undefined}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading && <Spinner className="-ml-0.5" />}
      {children}
    </button>
  );
});

function Spinner({ className }: { className?: string }) {
  return (
    <svg
      className={cn("h-3.5 w-3.5 animate-spin", className)}
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle
        cx="12"
        cy="12"
        r="9"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeOpacity="0.25"
        fill="none"
      />
      <path
        d="M21 12a9 9 0 0 1-9 9"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}
