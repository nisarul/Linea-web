// SPDX-License-Identifier: AGPL-3.0-or-later
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, Outlet, useNavigate, useParams } from "@tanstack/react-router";
import { Badge, Button, Card, CardBody, Dialog, Select, SubNav } from "@/components";
import {
  deleteGenealogy,
  getGenealogy,
  isOwner,
  leaveGenealogy,
  prettyRole,
  prettyVisibility,
  updateVisibility,
  type Genealogy,
  type Visibility,
} from "@/lib/genealogies";

/**
 * GenealogyDetailLayout is the route component for /g/$id. It
 * fetches the genealogy, renders a sticky header with title +
 * owner actions + tab strip, then yields to the matched child
 * route via <Outlet /> (Overview / Persons / Tree).
 */
export function GenealogyDetailLayout() {
  const { id } = useParams({ strict: false }) as { id: string };
  const q = useQuery({
    queryKey: ["genealogy", id],
    queryFn: () => getGenealogy(id),
  });

  if (q.isLoading) {
    return <div className="h-32 animate-pulse rounded-lg bg-(--color-bg-sunken)" />;
  }
  if (q.isError) {
    return (
      <Card>
        <CardBody className="text-(--color-fg-danger)">
          Could not load: {(q.error as Error).message}{" "}
          <Link to="/" className="underline">Back to dashboard</Link>
        </CardBody>
      </Card>
    );
  }
  if (!q.data?.genealogy) return null;
  const g = q.data.genealogy;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link
            to="/"
            className="text-xs text-(--color-fg-muted) hover:text-(--color-fg-secondary)"
          >
            ← Dashboard
          </Link>
          <h1 className="mt-1 font-serif text-3xl tracking-tight">{g.name}</h1>
          <div className="mt-2 flex items-center gap-2 text-xs text-(--color-fg-muted)">
            <Badge tone={visibilityTone(g.visibility)}>
              {prettyVisibility(g.visibility)}
            </Badge>
            <span>·</span>
            <span>Your role: {prettyRole(g.myRole)}</span>
          </div>
        </div>
        <OwnerActions g={g} />
      </header>

      <SubNav
        items={[
          { to: "/g/$id", params: { id }, label: "Overview", exact: true },
          { to: "/g/$id/persons", params: { id }, label: "Persons" },
          { to: "/g/$id/tree", params: { id }, label: "Tree" },
        ]}
      />

      <Outlet />
    </div>
  );
}

function OwnerActions({ g }: { g: Genealogy }) {
  const qc = useQueryClient();
  const nav = useNavigate();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const vis = useMutation({
    mutationFn: (v: Visibility) => updateVisibility(g.id, v),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["genealogy", g.id] }),
  });
  const del = useMutation({
    mutationFn: () => deleteGenealogy(g.id),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["genealogies"] });
      await nav({ to: "/" });
    },
  });
  const leave = useMutation({
    mutationFn: () => leaveGenealogy(g.id),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["genealogies"] });
      await nav({ to: "/" });
    },
  });

  if (!isOwner(g.myRole)) {
    if (g.myRole === "GENEALOGY_ROLE_NONE" || g.myRole === "GENEALOGY_ROLE_UNSPECIFIED") {
      return null;
    }
    return (
      <Button variant="ghost" onClick={() => leave.mutate()} isLoading={leave.isPending}>
        Leave genealogy
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Select
        value={g.visibility}
        onChange={(e) => vis.mutate(e.target.value as Visibility)}
        disabled={vis.isPending}
        className="w-40"
        aria-label="Visibility"
      >
        <option value="VISIBILITY_PRIVATE">Private</option>
        <option value="VISIBILITY_UNLISTED">Unlisted</option>
        <option value="VISIBILITY_PUBLIC">Public</option>
      </Select>
      <Button variant="danger" onClick={() => setConfirmDelete(true)}>
        Delete
      </Button>

      <Dialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Delete genealogy?"
        description={`This permanently deletes "${g.name}" and all of its data. This cannot be undone.`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmDelete(false)} disabled={del.isPending}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => del.mutate()}
              isLoading={del.isPending}
            >
              Delete permanently
            </Button>
          </>
        }
      >
        <p className="text-sm text-(--color-fg-secondary)">
          We will tighten this with a name-confirmation step in phase 9.
        </p>
      </Dialog>
    </div>
  );
}

function visibilityTone(v: Visibility) {
  switch (v) {
    case "VISIBILITY_PUBLIC":   return "success" as const;
    case "VISIBILITY_UNLISTED": return "info" as const;
    case "VISIBILITY_PRIVATE":  return "neutral" as const;
    default:                    return "neutral" as const;
  }
}
