// SPDX-License-Identifier: AGPL-3.0-or-later

import { apiFetch } from "./api";

export type RelationshipType =
  | "RELATIONSHIP_TYPE_PARENT_CHILD"
  | "RELATIONSHIP_TYPE_MARRIAGE"
  | "RELATIONSHIP_TYPE_UNSPECIFIED";

export type Certainty =
  | "CERTAINTY_CERTAIN"
  | "CERTAINTY_PROBABLE"
  | "CERTAINTY_UNCERTAIN"
  | "CERTAINTY_UNSPECIFIED";

export interface Continuity {
  state?: "CONTINUITY_STATE_CONTINUOUS" | "CONTINUITY_STATE_GAPPED" | "CONTINUITY_STATE_UNSPECIFIED";
  gapKnownSize?: boolean;
  gapSize?: number;
}

export interface Relationship {
  id: { value: string };
  fromPerson: { value: string };
  toPerson: { value: string };
  type: RelationshipType;
  certainty?: Certainty;
  continuity?: Continuity;
  notes?: string;
}

export interface ListRelationshipsResponse {
  relationships?: Relationship[];
  nextPageToken?: string;
  graphVersion?: string;
}

export function listRelationships(
  genealogyId: string,
  pageSize = 500,
): Promise<ListRelationshipsResponse> {
  return apiFetch<ListRelationshipsResponse>(
    `/api/v1/g/${encodeURIComponent(genealogyId)}/relationships?page_size=${pageSize}`,
  );
}

export function prettyCertainty(c?: Certainty): string {
  if (!c) return "—";
  return c.replace(/^CERTAINTY_/, "").toLowerCase();
}
