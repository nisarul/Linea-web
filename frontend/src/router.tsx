// SPDX-License-Identifier: AGPL-3.0-or-later
//
// TanStack Router setup. We use the code-first (no codegen) flow:
// rootRoute + child routes assembled into a route tree.

import {
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
} from "@tanstack/react-router";
import { AppShell } from "@/layout/AppShell";
import { DashboardPage } from "@/pages/DashboardPage";
import { GenealogiesPage } from "@/pages/GenealogiesPage";
import { GenealogyDetailPage } from "@/pages/GenealogyDetailPage";
import { DesignSystemPage } from "@/pages/DesignSystemPage";

const rootRoute = createRootRoute({
  component: () => (
    <AppShell>
      <Outlet />
    </AppShell>
  ),
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: DashboardPage,
});

const genealogiesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/genealogies",
  component: GenealogiesPage,
});

const genealogyDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/g/$id",
  component: GenealogyDetailPage,
});

const designRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/design",
  component: DesignSystemPage,
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  genealogiesRoute,
  genealogyDetailRoute,
  designRoute,
]);

export const router = createRouter({
  routeTree,
  defaultPreload: "intent",
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
