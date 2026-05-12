// SPDX-License-Identifier: AGPL-3.0-or-later
import type { HTMLAttributes, PropsWithChildren } from "react";
import { cn } from "@/lib/cn";

/**
 * Card — a surface container with one of three elevations.
 * "flat"   — no shadow, just a subtle border.
 * "raised" — shadow-2; default for content panels.
 * "popover"— shadow-3; used inside dropdowns / popovers.
 */
export type CardElevation = "flat" | "raised" | "popover";

export interface CardProps
  extends HTMLAttributes<HTMLDivElement>,
    PropsWithChildren {
  elevation?: CardElevation;
}

const elevations: Record<CardElevation, string> = {
  flat: "shadow-none",
  raised: "shadow-(--shadow-2)",
  popover: "shadow-(--shadow-3)",
};

export function Card({
  elevation = "raised",
  className,
  children,
  ...rest
}: CardProps) {
  return (
    <div
      className={cn(
        "bg-(--color-bg-surface) text-(--color-fg-primary)",
        "border border-(--color-border-subtle) rounded-(--radius-lg)",
        elevations[elevation],
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  className,
  children,
  ...rest
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "px-5 py-4 border-b border-(--color-border-subtle)",
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

export function CardBody({
  className,
  children,
  ...rest
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("p-5", className)} {...rest}>
      {children}
    </div>
  );
}
