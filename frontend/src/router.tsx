// SPDX-License-Identifier: AGPL-3.0-or-later
//
// TanStack Router setup. We use the code-first (no codegen) flow:
// rootRoute + child routes assembled into a route tree.

import { lazy } from "react";
import {
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
} from "@tanstack/react-router";
import { AppShell } from "@/layout/AppShell";
import { DashboardPage } from "@/pages/DashboardPage";
import { GenealogiesPage } from "@/pages/GenealogiesPage";
import { GenealogyDetailLayout } from "@/pages/GenealogyDetailLayout";
import { GenealogyOverviewPage } from "@/pages/GenealogyOverviewPage";
import { PersonsListPage } from "@/pages/PersonsListPage";
import { PersonDetailPage } from "@/pages/PersonDetailPage";
import { ProposalsListPage } from "@/pages/ProposalsListPage";
import { ProposalDetailPage } from "@/pages/ProposalDetailPage";
import { QueriesPage } from "@/pages/QueriesPage";
import { DesignSystemPage } from "@/pages/DesignSystemPage";

// Tree canvas pulls in Konva (~300 kB). Code-split so it only
// loads when the user opens the Tree tab.
const GenealogyTreePage = lazy(() =>
  import("@/pages/GenealogyTreePage").then((m) => ({ default: m.GenealogyTreePage })),
);

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

const genealogyLayoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/g/$id",
  component: GenealogyDetailLayout,
});

const genealogyOverviewRoute = createRoute({
  getParentRoute: () => genealogyLayoutRoute,
  path: "/",
  component: GenealogyOverviewPage,
});

const personsListRoute = createRoute({
  getParentRoute: () => genealogyLayoutRoute,
  path: "persons",
  component: PersonsListPage,
});

const personDetailRoute = createRoute({
  getParentRoute: () => genealogyLayoutRoute,
  path: "persons/$personId",
  component: PersonDetailPage,
});

const treeRoute = createRoute({
  getParentRoute: () => genealogyLayoutRoute,
  path: "tree",
  component: GenealogyTreePage,
});

const proposalsListRoute = createRoute({
  getParentRoute: () => genealogyLayoutRoute,
  path: "proposals",
  component: ProposalsListPage,
});

const proposalDetailRoute = createRoute({
  getParentRoute: () => genealogyLayoutRoute,
  path: "proposals/$proposalId",
  component: ProposalDetailPage,
});

const queriesRoute = createRoute({
  getParentRoute: () => genealogyLayoutRoute,
  path: "queries",
  component: QueriesPage,
});

const designRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/design",
  component: DesignSystemPage,
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  genealogiesRoute,
  genealogyLayoutRoute.addChildren([
    genealogyOverviewRoute,
    personsListRoute,
    personDetailRoute,
    treeRoute,
    proposalsListRoute,
    proposalDetailRoute,
    queriesRoute,
  ]),
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
