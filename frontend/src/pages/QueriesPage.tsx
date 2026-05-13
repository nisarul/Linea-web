// SPDX-License-Identifier: AGPL-3.0-or-later
import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link, useParams } from "@tanstack/react-router";
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  Input,
  Select,
} from "@/components";
import { listPersons, preferredName, type Person } from "@/lib/persons";
import {
  findPaths,
  nkca,
  prettyClassification,
  type NKCAResponse,
  type Path,
  type Step,
} from "@/lib/queries";
import { prettyCertainty } from "@/lib/relationships";
import { ApiError } from "@/lib/api";

type Tab = "paths" | "nkca";

export function QueriesPage() {
  const { id } = useParams({ strict: false }) as { id: string };
  const [tab, setTab] = useState<Tab>("paths");

  const persons = useQuery({
    queryKey: ["persons", id],
    queryFn: () => listPersons(id),
  });
  const personList = persons.data?.persons ?? [];

  return (
    <div className="space-y-6">
      <div role="tablist" className="inline-flex rounded-(--radius-md) border border-(--color-border-default) bg-(--color-bg-surface) p-0.5">
        {(["paths", "nkca"] as const).map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={
              "rounded-[calc(var(--radius-md)-2px)] px-3 py-1 text-sm transition-colors " +
              (tab === t
                ? "bg-(--color-accent) text-(--color-fg-on-accent)"
                : "text-(--color-fg-secondary) hover:text-(--color-fg-primary)")
            }
          >
            {t === "paths" ? "Find paths" : "Nearest known common ancestor"}
          </button>
        ))}
      </div>

      {persons.isLoading ? (
        <div className="h-32 animate-pulse rounded-lg bg-(--color-bg-sunken)" />
      ) : personList.length === 0 ? (
        <Card>
          <CardBody className="text-sm text-(--color-fg-muted)">
            This genealogy has no persons yet. Add persons via proposals before running queries.
          </CardBody>
        </Card>
      ) : tab === "paths" ? (
        <FindPathsPanel genealogyId={id} persons={personList} />
      ) : (
        <NKCAPanel genealogyId={id} persons={personList} />
      )}
    </div>
  );
}

function FindPathsPanel({ genealogyId, persons }: { genealogyId: string; persons: Person[] }) {
  const sorted = useMemo(
    () => [...persons].sort((a, b) => preferredName(a).localeCompare(preferredName(b))),
    [persons],
  );
  const index = useMemo(() => new Map(persons.map((p) => [p.id.value, p])), [persons]);

  const [from, setFrom] = useState<string>(sorted[0]?.id.value ?? "");
  const [to, setTo] = useState<string>(sorted[1]?.id.value ?? sorted[0]?.id.value ?? "");
  const [maxDepth, setMaxDepth] = useState(8);
  const [maxPaths, setMaxPaths] = useState(10);
  const [includeAffinal, setIncludeAffinal] = useState(false);

  const run = useMutation({
    mutationFn: () =>
      findPaths({ genealogyId, from, to, maxDepth, maxPaths, includeAffinal }),
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardBody>
          <form
            className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
            onSubmit={(e) => {
              e.preventDefault();
              run.mutate();
            }}
          >
            <PersonSelect label="From" value={from} onChange={setFrom} persons={sorted} />
            <PersonSelect label="To" value={to} onChange={setTo} persons={sorted} />
            <label className="space-y-1">
              <span className="text-xs font-medium text-(--color-fg-secondary)">Max depth</span>
              <Input
                type="number"
                min={1}
                max={20}
                value={maxDepth}
                onChange={(e) => setMaxDepth(parseInt(e.target.value || "0") || 0)}
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-medium text-(--color-fg-secondary)">Max paths</span>
              <Input
                type="number"
                min={1}
                max={100}
                value={maxPaths}
                onChange={(e) => setMaxPaths(parseInt(e.target.value || "0") || 0)}
              />
            </label>
            <label className="flex items-center gap-2 self-end pb-1 sm:col-span-2">
              <input
                type="checkbox"
                className="h-4 w-4 accent-(--color-accent)"
                checked={includeAffinal}
                onChange={(e) => setIncludeAffinal(e.target.checked)}
              />
              <span className="text-sm">
                Include affinal (marriage-only) paths
              </span>
            </label>
            <div className="sm:col-span-2 lg:col-span-4 flex justify-end">
              <Button type="submit" variant="primary" isLoading={run.isPending}>
                Find paths
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>

      {run.error && (
        <Card>
          <CardBody className="text-(--color-fg-danger)">
            {run.error instanceof ApiError ? run.error.message : String(run.error)}
          </CardBody>
        </Card>
      )}

      {run.data && (
        <PathsResults
          paths={run.data.paths ?? []}
          genealogyId={genealogyId}
          index={index}
        />
      )}
    </div>
  );
}

function NKCAPanel({ genealogyId, persons }: { genealogyId: string; persons: Person[] }) {
  const sorted = useMemo(
    () => [...persons].sort((a, b) => preferredName(a).localeCompare(preferredName(b))),
    [persons],
  );
  const index = useMemo(() => new Map(persons.map((p) => [p.id.value, p])), [persons]);
  const [a, setA] = useState<string>(sorted[0]?.id.value ?? "");
  const [b, setB] = useState<string>(sorted[1]?.id.value ?? sorted[0]?.id.value ?? "");

  const run = useMutation({
    mutationFn: () => nkca({ genealogyId, a, b }),
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardBody>
          <form
            className="grid gap-3 sm:grid-cols-3"
            onSubmit={(e) => {
              e.preventDefault();
              run.mutate();
            }}
          >
            <PersonSelect label="Person A" value={a} onChange={setA} persons={sorted} />
            <PersonSelect label="Person B" value={b} onChange={setB} persons={sorted} />
            <div className="flex items-end justify-end">
              <Button type="submit" variant="primary" isLoading={run.isPending}>
                Find ancestor
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>

      {run.error && (
        <Card>
          <CardBody className="text-(--color-fg-danger)">
            {run.error instanceof ApiError ? run.error.message : String(run.error)}
          </CardBody>
        </Card>
      )}

      {run.data && (
        <NKCAResults res={run.data} genealogyId={genealogyId} index={index} />
      )}
    </div>
  );
}

function PersonSelect({
  label,
  value,
  onChange,
  persons,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  persons: Person[];
}) {
  return (
    <label className="space-y-1">
      <span className="text-xs font-medium text-(--color-fg-secondary)">{label}</span>
      <Select value={value} onChange={(e) => onChange(e.target.value)}>
        {persons.map((p) => (
          <option key={p.id.value} value={p.id.value}>
            {preferredName(p)}
          </option>
        ))}
      </Select>
    </label>
  );
}

function PathsResults({
  paths,
  genealogyId,
  index,
}: {
  paths: Path[];
  genealogyId: string;
  index: Map<string, Person>;
}) {
  if (paths.length === 0) {
    return (
      <Card>
        <CardBody className="text-sm text-(--color-fg-muted)">
          No paths found within the depth limit.
        </CardBody>
      </Card>
    );
  }
  return (
    <div className="space-y-3">
      {paths.map((p, i) => (
        <PathCard key={i} index={i} p={p} genealogyId={genealogyId} personIndex={index} />
      ))}
    </div>
  );
}

function PathCard({
  index,
  p,
  genealogyId,
  personIndex,
}: {
  index: number;
  p: Path;
  genealogyId: string;
  personIndex: Map<string, Person>;
}) {
  return (
    <Card>
      <CardHeader className="flex items-center justify-between gap-2">
        <h3 className="font-serif text-base tracking-tight">
          Path {index + 1}
          <span className="ml-2 text-xs font-normal text-(--color-fg-muted)">
            length {p.length}
          </span>
        </h3>
        <div className="flex items-center gap-2 text-xs">
          <Badge tone={classificationTone(p.classification)}>
            {prettyClassification(p.classification)}
          </Badge>
          <Badge tone={certaintyTone(p.certainty)}>
            {prettyCertainty(p.certainty)}
          </Badge>
          {p.gapEdgeCount ? (
            <Badge tone="warn">
              {p.gapEdgeCount} gap edge{p.gapEdgeCount === 1 ? "" : "s"}
              {p.totalGapGenerations
                ? ` · ${p.totalGapGenerations} gen`
                : ""}
            </Badge>
          ) : null}
        </div>
      </CardHeader>
      <CardBody>
        <ol className="space-y-2">
          {(p.steps ?? []).map((s, i) => (
            <StepRow
              key={i}
              s={s}
              genealogyId={genealogyId}
              personIndex={personIndex}
            />
          ))}
        </ol>
      </CardBody>
    </Card>
  );
}

function StepRow({
  s,
  genealogyId,
  personIndex,
}: {
  s: Step;
  genealogyId: string;
  personIndex: Map<string, Person>;
}) {
  const fromName = personIndex.get(s.fromPerson.value);
  const toName = personIndex.get(s.toPerson.value);
  const verb =
    s.type === "RELATIONSHIP_TYPE_PARENT_CHILD"
      ? "→ parent/child"
      : s.type === "RELATIONSHIP_TYPE_MARRIAGE"
        ? "↔ married"
        : "→";
  return (
    <li className="flex flex-wrap items-center gap-2 text-sm">
      <PersonLink genealogyId={genealogyId} id={s.fromPerson.value} name={fromName ? preferredName(fromName) : undefined} />
      <span className="text-(--color-fg-muted)">{verb}</span>
      <PersonLink genealogyId={genealogyId} id={s.toPerson.value} name={toName ? preferredName(toName) : undefined} />
      <Badge tone={certaintyTone(s.certainty)}>{prettyCertainty(s.certainty)}</Badge>
      {s.continuity?.state === "CONTINUITY_STATE_GAPPED" && (
        <Badge tone="warn">
          gap{s.continuity.gapKnownSize && s.continuity.gapSize ? ` ${s.continuity.gapSize}` : ""}
        </Badge>
      )}
      {s.isWeakestLink && (
        <span className="text-xs text-(--color-fg-muted)">weakest link</span>
      )}
    </li>
  );
}

function PersonLink({
  genealogyId,
  id,
  name,
}: {
  genealogyId: string;
  id: string;
  name?: string;
}) {
  return (
    <Link
      to="/g/$id/persons/$personId"
      params={{ id: genealogyId, personId: id }}
      className="font-serif tracking-tight underline-offset-2 hover:underline"
    >
      <bdi dir="auto">{name ?? id.slice(0, 8)}</bdi>
    </Link>
  );
}

function NKCAResults({
  res,
  genealogyId,
  index,
}: {
  res: NKCAResponse;
  genealogyId: string;
  index: Map<string, Person>;
}) {
  if (!res.ancestorId) {
    return (
      <Card>
        <CardBody className="text-sm text-(--color-fg-muted)">
          No common ancestor found within the searched depth.
        </CardBody>
      </Card>
    );
  }
  const aId = res.ancestorId.value;
  const ancestor = index.get(aId);
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <h3 className="font-serif text-base tracking-tight">Common ancestor</h3>
        </CardHeader>
        <CardBody className="space-y-2 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <PersonLink
              genealogyId={genealogyId}
              id={aId}
              name={ancestor ? preferredName(ancestor) : undefined}
            />
            {res.ancestorIsUnknown && <Badge tone="warn">Unknown ancestor</Badge>}
            <Badge tone={certaintyTone(res.combinedCertainty)}>
              {prettyCertainty(res.combinedCertainty)}
            </Badge>
          </div>
          <div className="text-xs text-(--color-fg-muted)">
            Total {res.totalGenerations ?? "?"} generation
            {res.totalGenerations === 1 ? "" : "s"} between A and B
          </div>
        </CardBody>
      </Card>

      {res.pathFromA && (
        <PathCard index={0} p={res.pathFromA} genealogyId={genealogyId} personIndex={index} />
      )}
      {res.pathFromB && (
        <PathCard index={1} p={res.pathFromB} genealogyId={genealogyId} personIndex={index} />
      )}
    </div>
  );
}

function certaintyTone(c: Step["certainty"]) {
  switch (c) {
    case "CERTAINTY_CERTAIN":   return "success" as const;
    case "CERTAINTY_PROBABLE":  return "info" as const;
    case "CERTAINTY_UNCERTAIN": return "warn" as const;
    default:                    return "neutral" as const;
  }
}

function classificationTone(c?: Path["classification"]) {
  switch (c) {
    case "PATH_CLASSIFICATION_LINEAGE": return "accent" as const;
    case "PATH_CLASSIFICATION_AFFINAL": return "info" as const;
    default:                            return "neutral" as const;
  }
}
