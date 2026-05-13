// SPDX-License-Identifier: AGPL-3.0-or-later
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "@tanstack/react-router";
import { Badge, Card, CardBody, CardHeader } from "@/components";
import { getPerson, lifeRange, preferredName, type Person } from "@/lib/persons";
import {
  listRelationships,
  prettyCertainty,
  type Relationship,
} from "@/lib/relationships";
import { listPersons } from "@/lib/persons";

export function PersonDetailPage() {
  const { id, personId } = useParams({ strict: false }) as {
    id: string;
    personId: string;
  };

  const q = useQuery({
    queryKey: ["person", id, personId],
    queryFn: () => getPerson(id, personId),
  });
  const rels = useQuery({
    queryKey: ["relationships", id],
    queryFn: () => listRelationships(id),
  });
  const persons = useQuery({
    queryKey: ["persons", id],
    queryFn: () => listPersons(id),
  });

  const personIndex = useMemo(() => {
    const m = new Map<string, Person>();
    for (const p of persons.data?.persons ?? []) m.set(p.id.value, p);
    return m;
  }, [persons.data]);

  const myRels = useMemo(() => {
    const all = rels.data?.relationships ?? [];
    return all.filter(
      (r) => r.fromPerson.value === personId || r.toPerson.value === personId,
    );
  }, [rels.data, personId]);

  if (q.isLoading) {
    return <div className="h-32 animate-pulse rounded-lg bg-(--color-bg-sunken)" />;
  }
  if (q.isError) {
    return (
      <Card>
        <CardBody className="text-(--color-fg-danger)">
          {(q.error as Error).message}{" "}
          <Link to="/g/$id/persons" params={{ id }} className="underline">
            Back to persons
          </Link>
        </CardBody>
      </Card>
    );
  }
  if (!q.data?.person) return null;
  const p = q.data.person;

  return (
    <div className="space-y-6">
      <header>
        <Link
          to="/g/$id/persons"
          params={{ id }}
          className="text-xs text-(--color-fg-muted) hover:text-(--color-fg-secondary)"
        >
          ← All persons
        </Link>
        <h1 className="mt-1 font-serif text-3xl tracking-tight">
          <bdi dir="auto">{preferredName(p)}</bdi>
        </h1>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-(--color-fg-secondary)">
          {lifeRange(p) && <span>{lifeRange(p)}</span>}
          {p.gender && <Badge>{p.gender}</Badge>}
          {p.unknownAncestor && <Badge tone="warn">Unknown ancestor</Badge>}
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <h2 className="font-serif text-base tracking-tight">Names</h2>
          </CardHeader>
          <CardBody>
            {!p.names || p.names.length === 0 ? (
              <p className="text-sm text-(--color-fg-muted)">No names recorded.</p>
            ) : (
              <ul className="space-y-1.5 text-sm">
                {p.names.map((n, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <bdi
                      dir="auto"
                      lang={n.language}
                      className="font-serif tracking-tight"
                    >
                      {n.text}
                    </bdi>
                    {n.preferred && <Badge tone="accent">Preferred</Badge>}
                    {n.type && (
                      <span className="text-xs text-(--color-fg-muted)">{n.type}</span>
                    )}
                    {n.script && (
                      <span className="text-xs text-(--color-fg-muted)">{n.script}</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="font-serif text-base tracking-tight">Vital dates</h2>
          </CardHeader>
          <CardBody className="space-y-2 text-sm">
            <Vital label="Birth" t={p.birth} />
            <Vital label="Death" t={p.death} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="font-serif text-base tracking-tight">Identity</h2>
          </CardHeader>
          <CardBody className="space-y-2 text-sm text-(--color-fg-secondary)">
            <div>
              <span className="text-(--color-fg-muted)">ID</span>{" "}
              <code className="text-xs">{p.id.value}</code>
            </div>
            {p.notes && (
              <div className="whitespace-pre-wrap text-(--color-fg-primary)">
                {p.notes}
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      <section>
        <h2 className="mb-3 font-serif text-lg tracking-tight">
          Relationships ({myRels.length})
        </h2>
        {myRels.length === 0 ? (
          <Card>
            <CardBody className="text-sm text-(--color-fg-muted)">
              No relationships recorded.
            </CardBody>
          </Card>
        ) : (
          <Card>
            <ul className="divide-y divide-(--color-border-subtle)">
              {myRels.map((r) => (
                <RelRow
                  key={r.id.value}
                  r={r}
                  selfId={personId}
                  genealogyId={id}
                  index={personIndex}
                />
              ))}
            </ul>
          </Card>
        )}
      </section>
    </div>
  );
}

function Vital({ label, t }: { label: string; t?: Person["birth"] }) {
  if (!t) {
    return (
      <div>
        <span className="text-(--color-fg-muted)">{label}</span>{" "}
        <span className="text-(--color-fg-muted)">—</span>
      </div>
    );
  }
  const range =
    t.earliestKnown && t.earliestYear
      ? (t.circa ? "c. " : "") + t.earliestYear
      : t.latestKnown && t.latestYear
        ? "≤ " + t.latestYear
        : "—";
  return (
    <div>
      <span className="text-(--color-fg-muted)">{label}</span>{" "}
      {range}
      {t.calendar && (
        <span className="ml-1 text-xs text-(--color-fg-muted)">({t.calendar})</span>
      )}
    </div>
  );
}

function RelRow({
  r,
  selfId,
  genealogyId,
  index,
}: {
  r: Relationship;
  selfId: string;
  genealogyId: string;
  index: Map<string, Person>;
}) {
  const otherId = r.fromPerson.value === selfId ? r.toPerson.value : r.fromPerson.value;
  const other = index.get(otherId);
  const otherName = other ? preferredName(other) : otherId.slice(0, 8);

  let rel = "";
  if (r.type === "RELATIONSHIP_TYPE_PARENT_CHILD") {
    rel = r.fromPerson.value === selfId ? "Parent of" : "Child of";
  } else if (r.type === "RELATIONSHIP_TYPE_MARRIAGE") {
    rel = "Married to";
  } else {
    rel = "Related to";
  }

  return (
    <li className="flex items-center gap-3 px-5 py-3">
      <div className="min-w-0 flex-1">
        <div className="text-sm">
          <span className="text-(--color-fg-muted)">{rel}</span>{" "}
          <Link
            to="/g/$id/persons/$personId"
            params={{ id: genealogyId, personId: otherId }}
            className="font-serif tracking-tight underline-offset-2 hover:underline"
          >
            <bdi dir="auto">{otherName}</bdi>
          </Link>
        </div>
        {r.continuity?.state === "CONTINUITY_STATE_GAPPED" && (
          <div className="text-xs text-(--color-fg-muted)">
            Gapped{" "}
            {r.continuity.gapKnownSize && r.continuity.gapSize
              ? `· ${r.continuity.gapSize} generation${r.continuity.gapSize === 1 ? "" : "s"}`
              : ""}
          </div>
        )}
      </div>
      <Badge tone={certaintyTone(r.certainty)}>
        {prettyCertainty(r.certainty)}
      </Badge>
    </li>
  );
}

function certaintyTone(c?: Relationship["certainty"]) {
  switch (c) {
    case "CERTAINTY_CERTAIN":   return "success" as const;
    case "CERTAINTY_PROBABLE":  return "info" as const;
    case "CERTAINTY_UNCERTAIN": return "warn" as const;
    default:                    return "neutral" as const;
  }
}
