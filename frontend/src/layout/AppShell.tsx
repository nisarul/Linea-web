// SPDX-License-Identifier: AGPL-3.0-or-later
import { type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ThemeToggle } from "@/components";
import { UserMenu } from "./UserMenu";

/**
 * AppShell is the persistent chrome around every authenticated
 * page: top bar with brand + search + theme + user menu, a
 * sidebar with primary navigation, and the routed page content.
 */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-(--color-bg-canvas) text-(--color-fg-primary)">
      <TopBar />
      <div className="mx-auto flex w-full max-w-[1400px]">
        <Sidebar />
        <main className="flex-1 px-8 py-8">{children}</main>
      </div>
    </div>
  );
}

function TopBar() {
  return (
    <header className="sticky top-0 z-30 border-b border-(--color-border-subtle) bg-(--color-bg-surface)/90 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-[1400px] items-center gap-4 px-6">
        <Link
          to="/"
          className="flex items-baseline gap-2 outline-none focus-visible:ring-2 focus-visible:ring-(--color-accent)/40 rounded-sm"
        >
          <span className="font-serif text-lg tracking-tight">Linea</span>
          <span className="hidden text-xs text-(--color-fg-muted) sm:inline">
            lineage, without assumptions
          </span>
        </Link>

        <div className="flex-1" />

        <nav aria-label="Top navigation" className="flex items-center gap-2">
          <ThemeToggle />
          <UserMenu />
        </nav>
      </div>
    </header>
  );
}

function Sidebar() {
  return (
    <aside className="hidden w-56 shrink-0 border-r border-(--color-border-subtle) px-3 py-6 md:block">
      <nav aria-label="Primary" className="flex flex-col gap-1">
        <SidebarLink to="/">Dashboard</SidebarLink>
        <SidebarLink to="/genealogies">Genealogies</SidebarLink>
      </nav>
    </aside>
  );
}

function SidebarLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link
      to={to}
      className="rounded-md px-3 py-1.5 text-sm text-(--color-fg-secondary) transition-colors hover:bg-(--color-bg-sunken) hover:text-(--color-fg-primary) data-[status=active]:bg-(--color-bg-sunken) data-[status=active]:text-(--color-fg-primary) outline-none focus-visible:ring-2 focus-visible:ring-(--color-accent)/40"
      activeProps={{ "data-status": "active" }}
    >
      {children}
    </Link>
  );
}
