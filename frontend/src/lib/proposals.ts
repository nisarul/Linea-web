// SPDX-License-Identifier: AGPL-3.0-or-later

import { apiFetch } from "./api";

export type ProposalState =
  | "PROPOSAL_STATE_DRAFT"
  | "PROPOSAL_STATE_SUBMITTED"
  | "PROPOSAL_STATE_UNDER_REVIEW"
  | "PROPOSAL_STATE_ACCEPTED"
  | "PROPOSAL_STATE_REJECTED"
  | "PROPOSAL_STATE_WITHDRAWN"
  | "PROPOSAL_STATE_UNSPECIFIED";

export type ProposalAction =
  | "PROPOSAL_ACTION_CREATE"
  | "PROPOSAL_ACTION_UPDATE"
  | "PROPOSAL_ACTION_RETRACT"
  | "PROPOSAL_ACTION_MERGE"
  | "PROPOSAL_ACTION_SAME_AS_LINK"
  | "PROPOSAL_ACTION_UNSPECIFIED";

export type EntityKind =
  | "ENTITY_KIND_PERSON"
  | "ENTITY_KIND_RELATIONSHIP"
  | "ENTITY_KIND_SOURCE"
  | "ENTITY_KIND_UNSPECIFIED";

export interface ProposalTransition {
  from: ProposalState;
  to: ProposalState;
  actor: string;
  at: string;
  reason?: string;
}

export interface Proposal {
  id: { value: string };
  state: ProposalState;
  action: ProposalAction;
  entityKind: EntityKind;
  targetId?: { value: string };
  secondaryId?: { value: string };
  /** base64-encoded JSON payload (per the proto: opaque bytes). */
  payload?: string;
  reason?: string;
  sources?: { value: string }[];
  author: string;
  createdAt: string;
  history?: ProposalTransition[];
}

export interface ListProposalsResponse {
  proposals?: Proposal[];
  nextPageToken?: string;
  graphVersion?: string;
}

export function listProposals(
  genealogyId: string,
  state?: ProposalState,
  pageSize = 200,
): Promise<ListProposalsResponse> {
  const url = new URL(
    `/api/v1/g/${encodeURIComponent(genealogyId)}/proposals`,
    window.location.origin,
  );
  url.searchParams.set("page_size", String(pageSize));
  if (state) url.searchParams.set("state_filter", state);
  return apiFetch<ListProposalsResponse>(
    url.pathname + url.search,
  );
}

export function getProposal(
  genealogyId: string,
  id: string,
): Promise<{ proposal: Proposal; graphVersion?: string }> {
  return apiFetch(
    `/api/v1/g/${encodeURIComponent(genealogyId)}/proposals/${encodeURIComponent(id)}`,
  );
}

export function createProposal(input: {
  genealogyId: string;
  action: ProposalAction;
  entityKind: EntityKind;
  targetId?: string;
  secondaryId?: string;
  /** Plain JSON. Will be base64-encoded for the bytes field. */
  payload?: unknown;
  reason?: string;
  sources?: string[];
}): Promise<{ proposal: Proposal }> {
  const body = {
    genealogyId: input.genealogyId,
    action: input.action,
    entityKind: input.entityKind,
    ...(input.targetId ? { targetId: { value: input.targetId } } : {}),
    ...(input.secondaryId ? { secondaryId: { value: input.secondaryId } } : {}),
    payload: input.payload !== undefined ? b64(JSON.stringify(input.payload)) : "",
    reason: input.reason ?? "",
    sources: (input.sources ?? []).map((v) => ({ value: v })),
  };
  return apiFetch(
    `/api/v1/g/${encodeURIComponent(input.genealogyId)}/proposals`,
    { method: "POST", body: JSON.stringify(body) },
  );
}

function transition(
  genealogyId: string,
  id: string,
  verb: "submit" | "claim" | "accept" | "reject" | "withdraw",
  reason?: string,
): Promise<Proposal> {
  return apiFetch<Proposal>(
    `/api/v1/g/${encodeURIComponent(genealogyId)}/proposals/${encodeURIComponent(id)}:${verb}`,
    {
      method: "POST",
      body: JSON.stringify({
        genealogyId,
        id: { value: id },
        reason: reason ?? "",
      }),
    },
  );
}

export const submitProposal   = (g: string, id: string, reason?: string) => transition(g, id, "submit",   reason);
export const claimProposal    = (g: string, id: string, reason?: string) => transition(g, id, "claim",    reason);
export const acceptProposal   = (g: string, id: string, reason?: string) => transition(g, id, "accept",   reason);
export const rejectProposal   = (g: string, id: string, reason: string)  => transition(g, id, "reject",   reason);
export const withdrawProposal = (g: string, id: string, reason?: string) => transition(g, id, "withdraw", reason);

export function bulkReject(input: {
  genealogyId: string;
  ids: string[];
  reason: string;
}): Promise<{ results?: { id: { value: string }; ok: boolean; error?: string }[] }> {
  return apiFetch(
    `/api/v1/g/${encodeURIComponent(input.genealogyId)}/proposals:bulkReject`,
    {
      method: "POST",
      body: JSON.stringify({
        genealogyId: input.genealogyId,
        ids: input.ids.map((v) => ({ value: v })),
        reason: input.reason,
      }),
    },
  );
}

export function prettyState(s: ProposalState): string {
  return s.replace(/^PROPOSAL_STATE_/, "").replace(/_/g, " ").toLowerCase();
}

export function prettyAction(a: ProposalAction): string {
  return a.replace(/^PROPOSAL_ACTION_/, "").replace(/_/g, " ").toLowerCase();
}

export function prettyKind(k: EntityKind): string {
  return k.replace(/^ENTITY_KIND_/, "").toLowerCase();
}

export function decodePayload(p?: string): unknown {
  if (!p) return null;
  try {
    const bin = atob(p);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return null;
  }
}

function b64(s: string): string {
  // btoa handles only Latin-1; encode as UTF-8 first.
  const bytes = new TextEncoder().encode(s);
  let bin = "";
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin);
}
