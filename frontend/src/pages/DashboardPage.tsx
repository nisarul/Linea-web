// SPDX-License-Identifier: AGPL-3.0-or-later
import { useQuery } from "@tanstack/react-query";
import { Badge, Button, Card, CardBody, CardHeader } from "@/components";
import { listGenealogies, type Genealogy } from "@/lib/genealogies";
import { fetchMe, login } from "@/lib/auth";

export function DashboardPage() {
  const me = useQuery({ queryKey: ["me"], queryFn: fetchMe, staleTime: 60_000 });

  if (!me.data?.authenticated) {
    return <SignedOutPitch />;
  }

  return <DashboardContent />;
}

function SignedOutPitch() {
  return (
    <div className="mx-auto max-w-2xl py-16 text-center">
      <h1 className="font-serif text-4xl tracking-tight">
        Lineage, without assumptions.
      </h1>
      <p className="mx-auto mt-4 max-w-lg text-(--color-fg-secondary)">
        Linea is a genealogical knowledge graph that records evidence
        with explicit certainty, gaps with explicit size, and identity
        with auditable history. Sign in to start a private genealogy or
        contribute to a public one.
      </p>
      <div className="mt-6 flex items-center justify-center gap-3">
        <Button
          variant="primary"
          size="lg"
          onClick={() => login(window.location.pathname)}
        >
          Sign in to get started
        </Button>
      </div>
    </div>
  );
}

function DashboardContent() {
  const q = useQuery({
    queryKey: ["genealogies"],
    queryFn: listGenealogies,
    staleTime: 30_000,
  });

  const items = q.data?.genealogies ?? [];
  const owned = items.filter((g) => g.myRole === "GENEALOGY_ROLE_OWNER");
  const member = items.filter(
    (g) =>
      g.myRole === "GENEALOGY_ROLE_CURATOR" ||
      g.myRole === "GENEALOGY_ROLE_CONTRIBUTOR" ||
      g.myRole === "GENEALOGY_ROLE_VIEWER",
  );
  const publics = items.filter(
    (g) =>
      g.visibility === "VISIBILITY_PUBLIC" &&
      (g.myRole === "GENEALOGY_ROLE_NONE" || g.myRole === "GENEALOGY_ROLE_UNSPECIFIED"),
  );

  return (
    <div className="space-y-10">
      <header className="flex items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl tracking-tight">Dashboard</h1>
          <p className="mt-1 text-(--color-fg-secondary)">
            Your genealogies, the ones you contribute to, and recent public ones.
          </p>
        </div>
        <Button variant="primary">New genealogy</Button>
      </header>

      {q.isLoading && <SkeletonGrid />}
      {q.isError && (
        <Card>
          <CardBody className="text-(--color-fg-danger)">
            Could not load genealogies: {String((q.error as Error).message)}
          </CardBody>
        </Card>
      )}

      {!q.isLoading && !q.isError && (
        <>
          <Section title="Owned by you" items={owned} emptyHint="Click New genealogy to create your first." />
          <Section title="You contribute to" items={member} emptyHint="Genealogies you join will appear here." />
          <Section title="Recent public" items={publics} emptyHint="No public genealogies yet." />
        </>
      )}
    </div>
  );
}

function Section({
  title,
  items,
  emptyHint,
}: {
  title: string;
  items: Genealogy[];
  emptyHint: string;
}) {
  return (
    <section>
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="font-serif text-lg tracking-tight">{title}</h2>
        <span className="text-xs text-(--color-fg-muted)">{items.length}</span>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-(--color-fg-muted)">{emptyHint}</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((g) => (
            <GenealogyCard key={g.id} g={g} />
          ))}
        </div>
      )}
    </section>
  );
}

function GenealogyCard({ g }: { g: Genealogy }) {
  return (
    <Card elevation="raised" interactive>
      <CardHeader className="flex items-center justify-between gap-2">
        <h3 className="truncate font-serif text-base tracking-tight">{g.name}</h3>
        <VisibilityBadge v={g.visibility} />
      </CardHeader>
      <CardBody className="text-xs text-(--color-fg-muted)">
        <div>Role: {prettyRole(g.myRole)}</div>
        <div className="mt-1">Created: {formatDate(g.createdAt)}</div>
      </CardBody>
    </Card>
  );
}

function VisibilityBadge({ v }: { v: Genealogy["visibility"] }) {
  switch (v) {
    case "VISIBILITY_PUBLIC":   return <Badge tone="success">Public</Badge>;
    case "VISIBILITY_UNLISTED": return <Badge tone="info">Unlisted</Badge>;
    case "VISIBILITY_PRIVATE":  return <Badge tone="neutral">Private</Badge>;
    default:                    return <Badge>—</Badge>;
  }
}

function prettyRole(r: Genealogy["myRole"]): string {
  return r.replace(/^GENEALOGY_ROLE_/, "").toLowerCase();
}

function formatDate(iso: string): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

function SkeletonGrid() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 3 }, (_, i) => (
        <div
          key={i}
          className="h-28 animate-pulse rounded-lg border border-(--color-border-subtle) bg-(--color-bg-sunken)"
        />
      ))}
    </div>
  );
}
