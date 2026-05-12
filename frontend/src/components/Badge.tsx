// SPDX-License-Identifier: AGPL-3.0-or-later
import type { HTMLAttributes, PropsWithChildren } from "react";
import { cn } from "@/lib/cn";

export type BadgeTone =
  | "neutral"
  | "info"
  | "success"
  | "warn"
  | "danger"
  | "accent";

export interface BadgeProps
  extends HTMLAttributes<HTMLSpanElement>,
    PropsWithChildren {
  tone?: BadgeTone;
}

const tones: Record<BadgeTone, string> = {
  neutral:
    "bg-(--color-bg-sunken) text-(--color-fg-secondary) border-(--color-border-default)",
  info: "bg-(--color-state-info-bg) text-(--color-state-info) border-(--color-state-info)/25",
  success:
    "bg-(--color-state-success-bg) text-(--color-state-success) border-(--color-state-success)/25",
  warn: "bg-(--color-state-warn-bg) text-(--color-state-warn) border-(--color-state-warn)/30",
  danger:
    "bg-(--color-state-danger-bg) text-(--color-state-danger) border-(--color-state-danger)/30",
  accent:
    "bg-(--color-accent-subtle) text-(--color-accent) border-(--color-accent)/25",
};

export function Badge({
  tone = "neutral",
  className,
  children,
  ...rest
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5",
        "text-xs font-medium border",
        tones[tone],
        className,
      )}
      {...rest}
    >
      {children}
    </span>
  );
}
