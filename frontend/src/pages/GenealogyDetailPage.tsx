// SPDX-License-Identifier: AGPL-3.0-or-later
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "@tanstack/react-router";
import { Badge, Button, Card, CardBody, CardHeader, Dialog, Input, Select } from "@/components";
import {
  canManageMembers,
  deleteGenealogy,
  getGenealogy,
  isOwner,
  leaveGenealogy,
  listMembers,
  prettyRole,
  prettyVisibility,
  removeMember,
  updateVisibility,
  upsertMembership,
  type Genealogy,
  type GenealogyRole,
  type Membership,
  type Visibility,
} from "@/lib/genealogies";
import { ApiError } from "@/lib/api";

export function GenealogyDetailPage() {
  const { id } = useParams({ strict: false }) as { id: string };
  const q = useQuery({
    queryKey: ["genealogy", id],
    queryFn: () => getGenealogy(id),
  });

  if (q.isLoading) {
    return <div className="h-32 animate-pulse rounded-lg bg-(--color-bg-sunken)" aria-hidden />;
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
  return <Detail g={q.data.genealogy} />;
}

function Detail({ g }: { g: Genealogy }) {
  return (
    <div className="space-y-8">
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

      <section className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <h2 className="font-serif text-base tracking-tight">Overview</h2>
          </CardHeader>
          <CardBody className="space-y-2 text-sm text-(--color-fg-secondary)">
            <div>
              <span className="text-(--color-fg-muted)">Created by</span>{" "}
              {g.createdBy}
            </div>
            <div>
              <span className="text-(--color-fg-muted)">Created at</span>{" "}
              {new Date(g.createdAt).toLocaleString()}
            </div>
            <div>
              <span className="text-(--color-fg-muted)">ID</span>{" "}
              <code className="text-xs">{g.id}</code>
            </div>
          </CardBody>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <h2 className="font-serif text-base tracking-tight">Graph</h2>
          </CardHeader>
          <CardBody className="text-sm text-(--color-fg-muted)">
            The interactive lineage canvas arrives in phase 4. Persons and
            relationships are not yet rendered.
          </CardBody>
        </Card>
      </section>

      <MembersSection g={g} />
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
          Type the genealogy name to confirm if you want a safety net — for now,
          the delete button does the work directly. We will tighten this in
          phase 9 hardening.
        </p>
      </Dialog>
    </div>
  );
}

function MembersSection({ g }: { g: Genealogy }) {
  const q = useQuery({
    queryKey: ["members", g.id],
    queryFn: () => listMembers(g.id),
    enabled: canManageMembers(g.myRole) || g.myRole === "GENEALOGY_ROLE_CONTRIBUTOR" || g.myRole === "GENEALOGY_ROLE_VIEWER",
  });
  const members = q.data?.memberships ?? [];

  return (
    <section>
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="font-serif text-lg tracking-tight">Members</h2>
        <span className="text-xs text-(--color-fg-muted)">{members.length}</span>
      </div>
      {canManageMembers(g.myRole) && <AddMemberRow g={g} />}
      {q.isLoading ? (
        <div className="h-24 animate-pulse rounded-lg bg-(--color-bg-sunken)" />
      ) : members.length === 0 ? (
        <Card>
          <CardBody className="text-sm text-(--color-fg-muted)">
            No explicit members yet.
          </CardBody>
        </Card>
      ) : (
        <Card>
          <ul className="divide-y divide-(--color-border-subtle)">
            {members.map((m) => (
              <MemberRow key={m.subject} g={g} m={m} />
            ))}
          </ul>
        </Card>
      )}
    </section>
  );
}

function AddMemberRow({ g }: { g: Genealogy }) {
  const qc = useQueryClient();
  const [subject, setSubject] = useState("");
  const [role, setRole] = useState<GenealogyRole>("GENEALOGY_ROLE_CONTRIBUTOR");
  const [err, setErr] = useState<string | null>(null);

  const m = useMutation({
    mutationFn: upsertMembership,
    onSuccess: () => {
      setSubject("");
      setErr(null);
      qc.invalidateQueries({ queryKey: ["members", g.id] });
    },
    onError: (e: unknown) =>
      setErr(e instanceof ApiError ? e.message : String(e)),
  });

  return (
    <Card className="mb-3">
      <CardBody>
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!subject.trim()) {
              setErr("Subject (user id) is required.");
              return;
            }
            m.mutate({ genealogyId: g.id, subject: subject.trim(), role });
          }}
        >
          <label className="min-w-64 flex-1 space-y-1">
            <span className="text-xs font-medium text-(--color-fg-secondary)">
              Subject (user id)
            </span>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="OIDC subject of the user"
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-medium text-(--color-fg-secondary)">
              Role
            </span>
            <Select
              value={role}
              onChange={(e) => setRole(e.target.value as GenealogyRole)}
              className="w-40"
            >
              {isOwner(g.myRole) && (
                <option value="GENEALOGY_ROLE_OWNER">Owner</option>
              )}
              <option value="GENEALOGY_ROLE_CURATOR">Curator</option>
              <option value="GENEALOGY_ROLE_CONTRIBUTOR">Contributor</option>
              <option value="GENEALOGY_ROLE_VIEWER">Viewer</option>
            </Select>
          </label>
          <Button type="submit" variant="primary" isLoading={m.isPending}>
            Add or update
          </Button>
        </form>
        {err && (
          <p className="mt-2 text-sm text-(--color-state-danger)">{err}</p>
        )}
      </CardBody>
    </Card>
  );
}

function MemberRow({ g, m }: { g: Genealogy; m: Membership }) {
  const qc = useQueryClient();
  const canManage = canManageMembers(g.myRole);

  const upd = useMutation({
    mutationFn: (role: GenealogyRole) =>
      upsertMembership({ genealogyId: g.id, subject: m.subject, role }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["members", g.id] }),
  });
  const rm = useMutation({
    mutationFn: () => removeMember({ genealogyId: g.id, subject: m.subject }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["members", g.id] }),
  });

  return (
    <li className="flex items-center gap-3 px-5 py-3">
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-(--color-accent)/15 text-xs font-medium text-(--color-accent)">
        {m.subject.slice(0, 2).toUpperCase()}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{m.subject}</div>
        <div className="text-xs text-(--color-fg-muted)">
          Granted by {m.grantedBy} · {new Date(m.grantedAt).toLocaleDateString()}
        </div>
      </div>
      {canManage ? (
        <>
          <Select
            value={m.role}
            onChange={(e) => upd.mutate(e.target.value as GenealogyRole)}
            className="w-36"
            disabled={upd.isPending}
            aria-label={`Role for ${m.subject}`}
          >
            {isOwner(g.myRole) && (
              <option value="GENEALOGY_ROLE_OWNER">Owner</option>
            )}
            <option value="GENEALOGY_ROLE_CURATOR">Curator</option>
            <option value="GENEALOGY_ROLE_CONTRIBUTOR">Contributor</option>
            <option value="GENEALOGY_ROLE_VIEWER">Viewer</option>
          </Select>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => rm.mutate()}
            isLoading={rm.isPending}
          >
            Remove
          </Button>
        </>
      ) : (
        <Badge>{prettyRole(m.role)}</Badge>
      )}
    </li>
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
