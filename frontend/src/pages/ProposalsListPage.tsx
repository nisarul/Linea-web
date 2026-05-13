// SPDX-License-Identifier: AGPL-3.0-or-later
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "@tanstack/react-router";
import {
  Badge,
  Button,
  Card,
  CardBody,
  Dialog,
  NewProposalDialog,
  Select,
  Textarea,
} from "@/components";
import {
  bulkReject,
  listProposals,
  prettyAction,
  prettyKind,
  prettyState,
  type Proposal,
  type ProposalState,
} from "@/lib/proposals";
import { canManageMembers, getGenealogy } from "@/lib/genealogies";

const STATE_OPTIONS: { value: "" | ProposalState; label: string }[] = [
  { value: "", label: "All states" },
  { value: "PROPOSAL_STATE_DRAFT", label: "Draft" },
  { value: "PROPOSAL_STATE_SUBMITTED", label: "Submitted" },
  { value: "PROPOSAL_STATE_UNDER_REVIEW", label: "Under review" },
  { value: "PROPOSAL_STATE_ACCEPTED", label: "Accepted" },
  { value: "PROPOSAL_STATE_REJECTED", label: "Rejected" },
  { value: "PROPOSAL_STATE_WITHDRAWN", label: "Withdrawn" },
];

export function ProposalsListPage() {
  const { id } = useParams({ strict: false }) as { id: string };
  const qc = useQueryClient();
  const [state, setState] = useState<"" | ProposalState>("");
  const [createOpen, setCreateOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkReason, setBulkReason] = useState("");

  const g = useQuery({
    queryKey: ["genealogy", id],
    queryFn: () => getGenealogy(id),
  });
  const proposals = useQuery({
    queryKey: ["proposals", id, state],
    queryFn: () => listProposals(id, state || undefined),
  });

  const canCurate = g.data?.genealogy
    ? canManageMembers(g.data.genealogy.myRole)
    : false;

  const items = useMemo(
    () => proposals.data?.proposals ?? [],
    [proposals.data],
  );

  const bulk = useMutation({
    mutationFn: bulkReject,
    onSuccess: async () => {
      setSelected(new Set());
      setBulkOpen(false);
      setBulkReason("");
      await qc.invalidateQueries({ queryKey: ["proposals", id] });
    },
  });

  function toggle(pid: string) {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(pid)) n.delete(pid);
      else n.add(pid);
      return n;
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={state}
          onChange={(e) => setState(e.target.value as "" | ProposalState)}
          className="w-48"
          aria-label="Filter by state"
        >
          {STATE_OPTIONS.map((o) => (
            <option key={o.value || "all"} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
        <span className="text-xs text-(--color-fg-muted)">{items.length}</span>
        <div className="flex-1" />
        {canCurate && selected.size > 0 && (
          <Button variant="danger" onClick={() => setBulkOpen(true)}>
            Bulk reject ({selected.size})
          </Button>
        )}
        <Button variant="primary" onClick={() => setCreateOpen(true)}>
          New proposal
        </Button>
      </div>

      {proposals.isLoading ? (
        <div className="h-32 animate-pulse rounded-lg bg-(--color-bg-sunken)" />
      ) : proposals.isError ? (
        <Card><CardBody className="text-(--color-fg-danger)">
          {(proposals.error as Error).message}
        </CardBody></Card>
      ) : items.length === 0 ? (
        <Card><CardBody className="text-sm text-(--color-fg-muted)">
          No proposals match the current filter.
        </CardBody></Card>
      ) : (
        <Card>
          <ul className="divide-y divide-(--color-border-subtle)">
            {items.map((p) => (
              <Row
                key={p.id.value}
                p={p}
                genealogyId={id}
                checked={selected.has(p.id.value)}
                onCheck={canCurate ? () => toggle(p.id.value) : undefined}
              />
            ))}
          </ul>
        </Card>
      )}

      <NewProposalDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        genealogyId={id}
      />

      <Dialog
        open={bulkOpen}
        onClose={() => setBulkOpen(false)}
        title={`Reject ${selected.size} proposal${selected.size === 1 ? "" : "s"}?`}
        description="A reason is required. It will be attached to each rejection."
        footer={
          <>
            <Button variant="ghost" onClick={() => setBulkOpen(false)} disabled={bulk.isPending}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() =>
                bulk.mutate({ genealogyId: id, ids: Array.from(selected), reason: bulkReason })
              }
              isLoading={bulk.isPending}
              disabled={!bulkReason.trim()}
            >
              Reject all
            </Button>
          </>
        }
      >
        <Textarea
          label="Reason"
          rows={3}
          value={bulkReason}
          onChange={(e) => setBulkReason(e.target.value)}
          placeholder="Why are these being rejected?"
        />
      </Dialog>
    </div>
  );
}

function Row({
  p,
  genealogyId,
  checked,
  onCheck,
}: {
  p: Proposal;
  genealogyId: string;
  checked: boolean;
  onCheck?: () => void;
}) {
  return (
    <li className="flex items-center gap-3 px-5 py-3">
      {onCheck && (
        <input
          type="checkbox"
          aria-label="Select for bulk action"
          checked={checked}
          onChange={onCheck}
          className="h-4 w-4 accent-(--color-accent)"
        />
      )}
      <Link
        to="/g/$id/proposals/$proposalId"
        params={{ id: genealogyId, proposalId: p.id.value }}
        className="flex min-w-0 flex-1 items-center gap-3 outline-none focus-visible:ring-2 focus-visible:ring-(--color-accent)/40 rounded-sm"
      >
        <StateBadge s={p.state} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm">
            <span className="font-medium">{prettyAction(p.action)}</span>{" "}
            <span className="text-(--color-fg-muted)">·</span>{" "}
            {prettyKind(p.entityKind)}
            {p.targetId?.value && (
              <span className="text-(--color-fg-muted)">
                {" · "}target {p.targetId.value.slice(0, 8)}…
              </span>
            )}
          </div>
          <div className="text-xs text-(--color-fg-muted)">
            By {p.author} · {new Date(p.createdAt).toLocaleString()}
          </div>
        </div>
      </Link>
    </li>
  );
}

export function StateBadge({ s }: { s: ProposalState }) {
  switch (s) {
    case "PROPOSAL_STATE_DRAFT":
      return <Badge>{prettyState(s)}</Badge>;
    case "PROPOSAL_STATE_SUBMITTED":
      return <Badge tone="info">{prettyState(s)}</Badge>;
    case "PROPOSAL_STATE_UNDER_REVIEW":
      return <Badge tone="accent">{prettyState(s)}</Badge>;
    case "PROPOSAL_STATE_ACCEPTED":
      return <Badge tone="success">{prettyState(s)}</Badge>;
    case "PROPOSAL_STATE_REJECTED":
      return <Badge tone="danger">{prettyState(s)}</Badge>;
    case "PROPOSAL_STATE_WITHDRAWN":
      return <Badge tone="warn">{prettyState(s)}</Badge>;
    default:
      return <Badge>{prettyState(s)}</Badge>;
  }
}
