// SPDX-License-Identifier: AGPL-3.0-or-later

import { apiFetch } from "./api";

export type Visibility =
  | "VISIBILITY_PRIVATE"
  | "VISIBILITY_UNLISTED"
  | "VISIBILITY_PUBLIC"
  | "VISIBILITY_UNSPECIFIED";

export type GenealogyRole =
  | "GENEALOGY_ROLE_OWNER"
  | "GENEALOGY_ROLE_CURATOR"
  | "GENEALOGY_ROLE_CONTRIBUTOR"
  | "GENEALOGY_ROLE_VIEWER"
  | "GENEALOGY_ROLE_NONE"
  | "GENEALOGY_ROLE_UNSPECIFIED";

export interface Genealogy {
  id: string;
  name: string;
  visibility: Visibility;
  createdBy: string;
  createdAt: string;
  myRole: GenealogyRole;
}

export interface Membership {
  subject: string;
  genealogyId: string;
  role: GenealogyRole;
  grantedBy: string;
  grantedAt: string;
}

export interface ListGenealogiesResponse {
  genealogies?: Genealogy[];
  nextPageToken?: string;
}

export interface ListMembersResponse {
  memberships?: Membership[];
  nextPageToken?: string;
}

export function listGenealogies(): Promise<ListGenealogiesResponse> {
  return apiFetch<ListGenealogiesResponse>("/api/v1/genealogies");
}

export function getGenealogy(id: string): Promise<{ genealogy: Genealogy }> {
  return apiFetch<{ genealogy: Genealogy }>(
    `/api/v1/genealogies/${encodeURIComponent(id)}`,
  );
}

export function createGenealogy(input: {
  name: string;
  visibility?: Visibility;
}): Promise<{ genealogy: Genealogy }> {
  return apiFetch<{ genealogy: Genealogy }>("/api/v1/genealogies", {
    method: "POST",
    body: JSON.stringify({
      name: input.name,
      visibility: input.visibility ?? "VISIBILITY_PRIVATE",
    }),
  });
}

export function deleteGenealogy(id: string): Promise<unknown> {
  return apiFetch<unknown>(`/api/v1/genealogies/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

export function updateVisibility(
  id: string,
  visibility: Visibility,
): Promise<Genealogy> {
  return apiFetch<Genealogy>(
    `/api/v1/genealogies/${encodeURIComponent(id)}/visibility`,
    {
      method: "PATCH",
      body: JSON.stringify({ id, visibility }),
    },
  );
}

export function listMembers(genealogyId: string): Promise<ListMembersResponse> {
  return apiFetch<ListMembersResponse>(
    `/api/v1/genealogies/${encodeURIComponent(genealogyId)}/members`,
  );
}

export function upsertMembership(input: {
  genealogyId: string;
  subject: string;
  role: GenealogyRole;
}): Promise<Membership> {
  return apiFetch<Membership>(
    `/api/v1/genealogies/${encodeURIComponent(input.genealogyId)}/members/${encodeURIComponent(input.subject)}`,
    {
      method: "PUT",
      body: JSON.stringify(input),
    },
  );
}

export function removeMember(input: {
  genealogyId: string;
  subject: string;
}): Promise<unknown> {
  return apiFetch<unknown>(
    `/api/v1/genealogies/${encodeURIComponent(input.genealogyId)}/members/${encodeURIComponent(input.subject)}`,
    { method: "DELETE" },
  );
}

export function leaveGenealogy(id: string): Promise<unknown> {
  return apiFetch<unknown>(
    `/api/v1/genealogies/${encodeURIComponent(id)}/leave`,
    { method: "POST", body: "{}" },
  );
}

/** Convenience: is the role at least Curator? (Owner ⊃ Curator) */
export function canManageMembers(role: GenealogyRole): boolean {
  return role === "GENEALOGY_ROLE_OWNER" || role === "GENEALOGY_ROLE_CURATOR";
}

export function isOwner(role: GenealogyRole): boolean {
  return role === "GENEALOGY_ROLE_OWNER";
}

export function prettyRole(r: GenealogyRole): string {
  return r.replace(/^GENEALOGY_ROLE_/, "").toLowerCase();
}

export function prettyVisibility(v: Visibility): string {
  return v.replace(/^VISIBILITY_/, "").toLowerCase();
}
