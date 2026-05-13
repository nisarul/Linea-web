// SPDX-License-Identifier: AGPL-3.0-or-later
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "@tanstack/react-router";
import { Badge, Card, CardBody, Input } from "@/components";
import { lifeRange, listPersons, preferredName, type Person } from "@/lib/persons";

export function PersonsListPage() {
  const { id } = useParams({ strict: false }) as { id: string };
  const q = useQuery({
    queryKey: ["persons", id],
    queryFn: () => listPersons(id),
  });
  const [search, setSearch] = useState("");

  const items = useMemo(() => {
    const persons = q.data?.persons ?? [];
    const s = search.trim().toLowerCase();
    if (!s) return persons;
    return persons.filter((p) =>
      preferredName(p).toLowerCase().includes(s) ||
      (p.names ?? []).some((n) => n.text.toLowerCase().includes(s)),
    );
  }, [q.data, search]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Filter by name…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
        <span className="text-xs text-(--color-fg-muted)">
          {items.length} of {q.data?.persons?.length ?? 0}
        </span>
      </div>

      {q.isLoading ? (
        <div className="h-32 animate-pulse rounded-lg bg-(--color-bg-sunken)" />
      ) : q.isError ? (
        <Card><CardBody className="text-(--color-fg-danger)">
          {(q.error as Error).message}
        </CardBody></Card>
      ) : items.length === 0 ? (
        <Card><CardBody className="text-sm text-(--color-fg-muted)">
          No persons match the current filter.
        </CardBody></Card>
      ) : (
        <Card>
          <ul className="divide-y divide-(--color-border-subtle)">
            {items.map((p) => (
              <Row key={p.id.value} genealogyId={id} p={p} />
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

function Row({ genealogyId, p }: { genealogyId: string; p: Person }) {
  const range = lifeRange(p);
  return (
    <li>
      <Link
        to="/g/$id/persons/$personId"
        params={{ id: genealogyId, personId: p.id.value }}
        className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-(--color-bg-sunken) outline-none focus-visible:ring-2 focus-visible:ring-(--color-accent)/40"
      >
        <div className="min-w-0 flex-1">
          <div className="truncate font-serif text-base tracking-tight">
            {preferredName(p)}
          </div>
          {range && (
            <div className="text-xs text-(--color-fg-muted)">{range}</div>
          )}
        </div>
        {p.unknownAncestor && <Badge tone="warn">Unknown</Badge>}
        {p.gender && <Badge>{p.gender}</Badge>}
      </Link>
    </li>
  );
}
