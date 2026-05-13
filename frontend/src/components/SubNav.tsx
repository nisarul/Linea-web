// SPDX-License-Identifier: AGPL-3.0-or-later
import { type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/cn";

/**
 * Sub-navigation strip used inside the genealogy detail layout.
 * Underlines the active tab. Tab activation is controlled by
 * TanStack Router's data-status="active" injection.
 */
export interface SubNavItem {
  to: string;
  /** Optional path params for parametric routes. */
  params?: Record<string, string>;
  label: ReactNode;
  /** When true, only matches when the URL is exactly `to`. */
  exact?: boolean;
}

export function SubNav({ items }: { items: SubNavItem[] }) {
  return (
    <nav
      aria-label="Section"
      className="-mb-px flex items-center gap-1 border-b border-(--color-border-subtle)"
    >
      {items.map((it) => (
        <Link
          key={typeof it.label === "string" ? it.label : it.to}
          to={it.to}
          params={it.params as never}
          activeOptions={it.exact ? { exact: true } : undefined}
          className={cn(
            "relative px-3 py-2 text-sm text-(--color-fg-secondary)",
            "transition-colors hover:text-(--color-fg-primary)",
            "outline-none focus-visible:ring-2 focus-visible:ring-(--color-accent)/40 rounded-sm",
            "data-[status=active]:text-(--color-fg-primary)",
            "data-[status=active]:after:absolute data-[status=active]:after:inset-x-2 data-[status=active]:after:-bottom-px data-[status=active]:after:h-0.5 data-[status=active]:after:bg-(--color-accent)",
          )}
        >
          {it.label}
        </Link>
      ))}
    </nav>
  );
}
