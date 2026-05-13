// SPDX-License-Identifier: AGPL-3.0-or-later
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button, Dialog, Input, Select, Textarea } from "@/components";
import {
  createProposal,
  type EntityKind,
  type ProposalAction,
} from "@/lib/proposals";
import { ApiError } from "@/lib/api";

export interface NewProposalDialogProps {
  open: boolean;
  onClose: () => void;
  genealogyId: string;
  onCreated?: (id: string) => void;
}

/**
 * NewProposalDialog — minimal first cut. Lets a user create a
 * Draft proposal by picking action + entity-kind, optional target
 * ids, an opaque JSON payload, and a reason. The payload textarea
 * is JSON-validated before submission. Rich per-action forms
 * (e.g. dedicated Person editor for CREATE-Person) land in
 * later phases once we wire Connect-RPC codegen.
 */
export function NewProposalDialog({
  open,
  onClose,
  genealogyId,
  onCreated,
}: NewProposalDialogProps) {
  const qc = useQueryClient();
  const [action, setAction] = useState<ProposalAction>("PROPOSAL_ACTION_CREATE");
  const [kind, setKind] = useState<EntityKind>("ENTITY_KIND_PERSON");
  const [targetId, setTargetId] = useState("");
  const [secondaryId, setSecondaryId] = useState("");
  const [reason, setReason] = useState("");
  const [payloadText, setPayloadText] = useState(
    '{\n  "names": [{ "text": "", "preferred": true }]\n}',
  );
  const [err, setErr] = useState<string | null>(null);

  const mut = useMutation({
    mutationFn: createProposal,
    onSuccess: async (res) => {
      await qc.invalidateQueries({ queryKey: ["proposals", genealogyId] });
      onCreated?.(res.proposal.id.value);
      reset();
      onClose();
    },
    onError: (e) =>
      setErr(e instanceof ApiError ? e.message : String(e)),
  });

  function reset() {
    setAction("PROPOSAL_ACTION_CREATE");
    setKind("ENTITY_KIND_PERSON");
    setTargetId("");
    setSecondaryId("");
    setReason("");
    setPayloadText('{\n  "names": [{ "text": "", "preferred": true }]\n}');
    setErr(null);
  }

  function submit() {
    setErr(null);
    let payload: unknown = null;
    if (payloadText.trim()) {
      try {
        payload = JSON.parse(payloadText);
      } catch (e) {
        setErr("Payload must be valid JSON: " + (e as Error).message);
        return;
      }
    }
    mut.mutate({
      genealogyId,
      action,
      entityKind: kind,
      targetId: targetId.trim() || undefined,
      secondaryId: secondaryId.trim() || undefined,
      payload,
      reason: reason.trim() || undefined,
    });
  }

  const needsTarget = action !== "PROPOSAL_ACTION_CREATE";
  const needsSecondary =
    action === "PROPOSAL_ACTION_MERGE" || action === "PROPOSAL_ACTION_SAME_AS_LINK";

  return (
    <Dialog
      open={open}
      onClose={() => {
        if (mut.isPending) return;
        reset();
        onClose();
      }}
      title="New proposal"
      description="Proposals are the only way to mutate a genealogy. They start as Draft and become visible to curators when submitted."
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={mut.isPending}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit} isLoading={mut.isPending}>
            Create draft
          </Button>
        </>
      }
    >
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1">
            <span className="text-xs font-medium text-(--color-fg-secondary)">Action</span>
            <Select
              value={action}
              onChange={(e) => setAction(e.target.value as ProposalAction)}
            >
              <option value="PROPOSAL_ACTION_CREATE">Create</option>
              <option value="PROPOSAL_ACTION_UPDATE">Update</option>
              <option value="PROPOSAL_ACTION_RETRACT">Retract</option>
              <option value="PROPOSAL_ACTION_MERGE">Merge</option>
              <option value="PROPOSAL_ACTION_SAME_AS_LINK">Same-as link</option>
            </Select>
          </label>
          <label className="space-y-1">
            <span className="text-xs font-medium text-(--color-fg-secondary)">Entity kind</span>
            <Select value={kind} onChange={(e) => setKind(e.target.value as EntityKind)}>
              <option value="ENTITY_KIND_PERSON">Person</option>
              <option value="ENTITY_KIND_RELATIONSHIP">Relationship</option>
              <option value="ENTITY_KIND_SOURCE">Source</option>
            </Select>
          </label>
        </div>

        {needsTarget && (
          <label className="block space-y-1">
            <span className="text-xs font-medium text-(--color-fg-secondary)">
              Target id
            </span>
            <Input
              value={targetId}
              onChange={(e) => setTargetId(e.target.value)}
              placeholder="ID of the existing entity to mutate"
            />
          </label>
        )}

        {needsSecondary && (
          <label className="block space-y-1">
            <span className="text-xs font-medium text-(--color-fg-secondary)">
              Secondary id
            </span>
            <Input
              value={secondaryId}
              onChange={(e) => setSecondaryId(e.target.value)}
              placeholder="ID being merged into target, or linked to"
            />
          </label>
        )}

        <Textarea
          label="Payload (JSON)"
          rows={6}
          value={payloadText}
          onChange={(e) => setPayloadText(e.target.value)}
          spellCheck={false}
          className="font-mono text-xs"
        />

        <Textarea
          label="Reason (optional)"
          rows={2}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />

        {err && (
          <div className="rounded-md border border-(--color-state-danger)/40 bg-(--color-state-danger-bg) px-3 py-2 text-sm text-(--color-state-danger)">
            {err}
          </div>
        )}
      </form>
    </Dialog>
  );
}
