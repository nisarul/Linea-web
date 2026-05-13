// SPDX-License-Identifier: AGPL-3.0-or-later
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "@tanstack/react-router";
import { Badge, Button, Card, CardBody, CardHeader, Input, Select } from "@/components";
import {
  canManageMembers,
  getGenealogy,
  isOwner,
  listMembers,
  prettyRole,
  removeMember,
  upsertMembership,
  type Genealogy,
  type GenealogyRole,
  type Membership,
} from "@/lib/genealogies";
import { ApiError } from "@/lib/api";

/**
 * Overview tab for a genealogy: identity facts + members section.
 * The header, breadcrumbs, and owner actions live in
 * GenealogyDetailLayout; this page renders only the body content.
 */
export function GenealogyOverviewPage() {
  const { id } = useParams({ strict: false }) as { id: string };
  const q = useQuery({
    queryKey: ["genealogy", id],
    queryFn: () => getGenealogy(id),
  });
  if (!q.data?.genealogy) return null;
  const g = q.data.genealogy;

  return (
    <div className="space-y-8">
      <section className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <h2 className="font-serif text-base tracking-tight">Identity</h2>
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
            <h2 className="font-serif text-base tracking-tight">What's here</h2>
          </CardHeader>
          <CardBody className="text-sm text-(--color-fg-secondary)">
            Use the <strong>Persons</strong> tab to browse individuals and
            their relationships, and the <strong>Tree</strong> tab to render
            ancestor or descendant trees from any focus person. Proposal-based
            edits and the curator review queue arrive in phase 5.
          </CardBody>
        </Card>
      </section>

      <MembersSection g={g} />
    </div>
  );
}

function MembersSection({ g }: { g: Genealogy }) {
  const enabled =
    canManageMembers(g.myRole) ||
    g.myRole === "GENEALOGY_ROLE_CONTRIBUTOR" ||
    g.myRole === "GENEALOGY_ROLE_VIEWER";

  const q = useQuery({
    queryKey: ["members", g.id],
    queryFn: () => listMembers(g.id),
    enabled,
  });
  const members = q.data?.memberships ?? [];

  return (
    <section>
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="font-serif text-lg tracking-tight">Members</h2>
        <span className="text-xs text-(--color-fg-muted)">{members.length}</span>
      </div>
      {canManageMembers(g.myRole) && <AddMemberRow g={g} />}
      {!enabled ? (
        <Card><CardBody className="text-sm text-(--color-fg-muted)">
          Member list is visible to members only.
        </CardBody></Card>
      ) : q.isLoading ? (
        <div className="h-24 animate-pulse rounded-lg bg-(--color-bg-sunken)" />
      ) : members.length === 0 ? (
        <Card><CardBody className="text-sm text-(--color-fg-muted)">
          No explicit members yet.
        </CardBody></Card>
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
