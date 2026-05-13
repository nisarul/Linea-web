// SPDX-License-Identifier: AGPL-3.0-or-later
import { useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "@tanstack/react-router";
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  Dialog,
  Textarea,
} from "@/components";
import {
  acceptProposal,
  claimProposal,
  decodePayload,
  getProposal,
  prettyAction,
  prettyKind,
  prettyState,
  rejectProposal,
  submitProposal,
  withdrawProposal,
  type Proposal,
} from "@/lib/proposals";
import { canManageMembers, getGenealogy } from "@/lib/genealogies";
import { fetchMe } from "@/lib/auth";
import { StateBadge } from "./ProposalsListPage";
import { ApiError } from "@/lib/api";

export function ProposalDetailPage() {
  const { id, proposalId } = useParams({ strict: false }) as {
    id: string;
    proposalId: string;
  };

  const g = useQuery({ queryKey: ["genealogy", id], queryFn: () => getGenealogy(id) });
  const me = useQuery({ queryKey: ["me"], queryFn: fetchMe, staleTime: 60_000 });
  const q = useQuery({
    queryKey: ["proposal", id, proposalId],
    queryFn: () => getProposal(id, proposalId),
  });

  if (q.isLoading) {
    return <div className="h-32 animate-pulse rounded-lg bg-(--color-bg-sunken)" />;
  }
  if (q.isError) {
    return (
      <Card>
        <CardBody className="text-(--color-fg-danger)">
          {(q.error as Error).message}{" "}
          <Link to="/g/$id/proposals" params={{ id }} className="underline">
            Back to proposals
          </Link>
        </CardBody>
      </Card>
    );
  }
  if (!q.data?.proposal) return null;
  const p = q.data.proposal;
  const isAuthor = me.data?.authenticated && me.data.subject === p.author;
  const canCurate = g.data?.genealogy
    ? canManageMembers(g.data.genealogy.myRole)
    : false;

  return (
    <div className="space-y-6">
      <header>
        <Link
          to="/g/$id/proposals"
          params={{ id }}
          className="text-xs text-(--color-fg-muted) hover:text-(--color-fg-secondary)"
        >
          ← All proposals
        </Link>
        <h1 className="mt-1 flex items-center gap-3 font-serif text-2xl tracking-tight">
          <StateBadge s={p.state} />
          <span>
            {prettyAction(p.action)} {prettyKind(p.entityKind)}
          </span>
        </h1>
        <div className="mt-1 text-xs text-(--color-fg-muted)">
          By {p.author} · {new Date(p.createdAt).toLocaleString()}
        </div>
      </header>

      <Actions
        p={p}
        isAuthor={!!isAuthor}
        canCurate={canCurate}
        genealogyId={id}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <h2 className="font-serif text-base tracking-tight">Targets</h2>
          </CardHeader>
          <CardBody className="space-y-2 text-sm text-(--color-fg-secondary)">
            <Row label="Target">
              {p.targetId?.value ? (
                <code className="text-xs">{p.targetId.value}</code>
              ) : (
                <span className="text-(--color-fg-muted)">—</span>
              )}
            </Row>
            <Row label="Secondary">
              {p.secondaryId?.value ? (
                <code className="text-xs">{p.secondaryId.value}</code>
              ) : (
                <span className="text-(--color-fg-muted)">—</span>
              )}
            </Row>
            <Row label="Sources">
              {p.sources && p.sources.length > 0 ? (
                <ul className="space-y-0.5">
                  {p.sources.map((s) => (
                    <li key={s.value}>
                      <code className="text-xs">{s.value}</code>
                    </li>
                  ))}
                </ul>
              ) : (
                <span className="text-(--color-fg-muted)">none</span>
              )}
            </Row>
          </CardBody>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <h2 className="font-serif text-base tracking-tight">Payload</h2>
          </CardHeader>
          <CardBody>
            <pre className="max-h-96 overflow-auto rounded-md bg-(--color-bg-sunken) p-3 text-xs">
              {prettyJSON(decodePayload(p.payload))}
            </pre>
            {p.reason && (
              <div className="mt-3 border-t border-(--color-border-subtle) pt-3">
                <div className="text-xs text-(--color-fg-muted)">Reason</div>
                <div className="text-sm">{p.reason}</div>
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      <History p={p} />
    </div>
  );
}

function Actions({
  p,
  isAuthor,
  canCurate,
  genealogyId,
}: {
  p: Proposal;
  isAuthor: boolean;
  canCurate: boolean;
  genealogyId: string;
}) {
  const qc = useQueryClient();
  const nav = useNavigate();
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const invalidate = () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: ["proposal", genealogyId, p.id.value] }),
      qc.invalidateQueries({ queryKey: ["proposals", genealogyId] }),
    ]);

  const onErr = (e: unknown) =>
    setErr(e instanceof ApiError ? e.message : String(e));

  const submit = useMutation({
    mutationFn: () => submitProposal(genealogyId, p.id.value),
    onSuccess: invalidate,
    onError: onErr,
  });
  const withdraw = useMutation({
    mutationFn: () => withdrawProposal(genealogyId, p.id.value),
    onSuccess: invalidate,
    onError: onErr,
  });
  const claim = useMutation({
    mutationFn: () => claimProposal(genealogyId, p.id.value),
    onSuccess: invalidate,
    onError: onErr,
  });
  const accept = useMutation({
    mutationFn: () => acceptProposal(genealogyId, p.id.value),
    onSuccess: async () => {
      await invalidate();
      await nav({ to: "/g/$id/proposals", params: { id: genealogyId } });
    },
    onError: onErr,
  });
  const reject = useMutation({
    mutationFn: () => rejectProposal(genealogyId, p.id.value, reason),
    onSuccess: async () => {
      setRejectOpen(false);
      setReason("");
      await invalidate();
    },
    onError: onErr,
  });

  const inDraft = p.state === "PROPOSAL_STATE_DRAFT";
  const inSubmitted = p.state === "PROPOSAL_STATE_SUBMITTED";
  const inReview = p.state === "PROPOSAL_STATE_UNDER_REVIEW";

  const buttons: ReactNode[] = [];
  if (isAuthor && inDraft) {
    buttons.push(
      <Button key="submit" variant="primary" onClick={() => submit.mutate()} isLoading={submit.isPending}>
        Submit for review
      </Button>,
    );
  }
  if (isAuthor && (inDraft || inSubmitted || inReview)) {
    buttons.push(
      <Button key="withdraw" variant="ghost" onClick={() => withdraw.mutate()} isLoading={withdraw.isPending}>
        Withdraw
      </Button>,
    );
  }
  if (canCurate && inSubmitted) {
    buttons.push(
      <Button key="claim" variant="secondary" onClick={() => claim.mutate()} isLoading={claim.isPending}>
        Claim for review
      </Button>,
    );
  }
  if (canCurate && (inSubmitted || inReview)) {
    buttons.push(
      <Button key="accept" variant="primary" onClick={() => accept.mutate()} isLoading={accept.isPending}>
        Accept
      </Button>,
      <Button key="reject" variant="danger" onClick={() => setRejectOpen(true)}>
        Reject
      </Button>,
    );
  }

  if (buttons.length === 0 && !err) return null;

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">{buttons}</div>
      {err && (
        <div className="rounded-md border border-(--color-state-danger)/40 bg-(--color-state-danger-bg) px-3 py-2 text-sm text-(--color-state-danger)">
          {err}
        </div>
      )}

      <Dialog
        open={rejectOpen}
        onClose={() => setRejectOpen(false)}
        title="Reject proposal?"
        description="A reason is required and will be permanently attached to the rejection event."
        footer={
          <>
            <Button variant="ghost" onClick={() => setRejectOpen(false)} disabled={reject.isPending}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => reject.mutate()}
              isLoading={reject.isPending}
              disabled={!reason.trim()}
            >
              Reject
            </Button>
          </>
        }
      >
        <Textarea
          label="Reason"
          rows={4}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </Dialog>
    </>
  );
}

function History({ p }: { p: Proposal }) {
  const entries = p.history ?? [];
  return (
    <section>
      <h2 className="mb-3 font-serif text-lg tracking-tight">History</h2>
      {entries.length === 0 ? (
        <Card>
          <CardBody className="text-sm text-(--color-fg-muted)">
            No transitions yet. The proposal is still in {prettyState(p.state)}.
          </CardBody>
        </Card>
      ) : (
        <Card>
          <ol className="divide-y divide-(--color-border-subtle)">
            {entries.map((t, i) => (
              <li key={i} className="px-5 py-3 text-sm">
                <div className="flex items-center gap-2">
                  <Badge>{prettyState(t.from)}</Badge>
                  <span className="text-(--color-fg-muted)">→</span>
                  <Badge>{prettyState(t.to)}</Badge>
                  <span className="ml-auto text-xs text-(--color-fg-muted)">
                    {new Date(t.at).toLocaleString()}
                  </span>
                </div>
                <div className="mt-1 text-xs text-(--color-fg-muted)">
                  by {t.actor}
                </div>
                {t.reason && (
                  <div className="mt-1 whitespace-pre-wrap text-(--color-fg-primary)">
                    {t.reason}
                  </div>
                )}
              </li>
            ))}
          </ol>
        </Card>
      )}
    </section>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <span className="text-(--color-fg-muted)">{label}</span> {children}
    </div>
  );
}

function prettyJSON(v: unknown): string {
  if (v === null || v === undefined) return "(empty)";
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return String(v);
  }
}
