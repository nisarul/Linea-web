// SPDX-License-Identifier: AGPL-3.0-or-later
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  Badge,
  Button,
  Card,
  CardBody,
  Input,
  NewGenealogyDialog,
  Select,
} from "@/components";
import {
  listGenealogies,
  prettyRole,
  prettyVisibility,
  type Genealogy,
  type Visibility,
} from "@/lib/genealogies";

type Filter = "ALL" | Visibility;

export function GenealogiesPage() {
  const nav = useNavigate();
  const q = useQuery({
    queryKey: ["genealogies"],
    queryFn: listGenealogies,
    staleTime: 30_000,
  });
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("ALL");
  const [createOpen, setCreateOpen] = useState(false);

  const filtered = useMemo(() => {
    const items = q.data?.genealogies ?? [];
    const s = search.trim().toLowerCase();
    return items.filter((g) => {
      if (filter !== "ALL" && g.visibility !== filter) return false;
      if (s && !g.name.toLowerCase().includes(s)) return false;
      return true;
    });
  }, [q.data, search, filter]);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl tracking-tight">Genealogies</h1>
          <p className="mt-1 text-(--color-fg-secondary)">
            Everything you can access — owned, member, or public.
          </p>
        </div>
        <Button variant="primary" onClick={() => setCreateOpen(true)}>
          New genealogy
        </Button>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Filter by name…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
        <Select
          value={filter}
          onChange={(e) => setFilter(e.target.value as Filter)}
          className="w-44"
          aria-label="Filter by visibility"
        >
          <option value="ALL">All visibilities</option>
          <option value="VISIBILITY_PRIVATE">Private</option>
          <option value="VISIBILITY_UNLISTED">Unlisted</option>
          <option value="VISIBILITY_PUBLIC">Public</option>
        </Select>
        <span className="text-xs text-(--color-fg-muted)">
          {filtered.length} of {q.data?.genealogies?.length ?? 0}
        </span>
      </div>

      {q.isLoading ? (
        <div className="h-32 animate-pulse rounded-lg bg-(--color-bg-sunken)" />
      ) : q.isError ? (
        <Card>
          <CardBody className="text-(--color-fg-danger)">
            Could not load: {(q.error as Error).message}
          </CardBody>
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <CardBody className="text-sm text-(--color-fg-muted)">
            No genealogies match the current filters.
          </CardBody>
        </Card>
      ) : (
        <Card>
          <ul className="divide-y divide-(--color-border-subtle)">
            {filtered.map((g) => (
              <Row key={g.id} g={g} />
            ))}
          </ul>
        </Card>
      )}

      <NewGenealogyDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(id) => void nav({ to: "/g/$id", params: { id } })}
      />
    </div>
  );
}

function Row({ g }: { g: Genealogy }) {
  return (
    <li>
      <Link
        to="/g/$id"
        params={{ id: g.id }}
        className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-(--color-bg-sunken) outline-none focus-visible:ring-2 focus-visible:ring-(--color-accent)/40"
      >
        <div className="min-w-0 flex-1">
          <div className="truncate font-serif text-base tracking-tight">{g.name}</div>
          <div className="text-xs text-(--color-fg-muted)">
            Created {new Date(g.createdAt).toLocaleDateString()} · Role {prettyRole(g.myRole)}
          </div>
        </div>
        <Badge tone={tone(g.visibility)}>{prettyVisibility(g.visibility)}</Badge>
      </Link>
    </li>
  );
}

function tone(v: Visibility) {
  switch (v) {
    case "VISIBILITY_PUBLIC":   return "success" as const;
    case "VISIBILITY_UNLISTED": return "info" as const;
    case "VISIBILITY_PRIVATE":  return "neutral" as const;
    default:                    return "neutral" as const;
  }
}
