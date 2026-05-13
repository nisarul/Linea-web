// SPDX-License-Identifier: AGPL-3.0-or-later

import { apiFetch } from "./api";
import type { Certainty, Continuity, RelationshipType } from "./relationships";

export type PathClassification =
  | "PATH_CLASSIFICATION_LINEAGE"
  | "PATH_CLASSIFICATION_AFFINAL"
  | "PATH_CLASSIFICATION_UNSPECIFIED";

export interface Step {
  fromPerson: { value: string };
  toPerson: { value: string };
  relationshipId: { value: string };
  type: RelationshipType;
  certainty?: Certainty;
  continuity?: Continuity;
  isWeakestLink?: boolean;
  sources?: { value: string }[];
}

export interface Path {
  from: { value: string };
  to: { value: string };
  length: number;
  certainty?: Certainty;
  totalGapGenerations?: number;
  gapEdgeCount?: number;
  classification?: PathClassification;
  steps?: Step[];
  graphVersion?: string;
}

export interface FindPathsResponse {
  paths?: Path[];
  graphVersion?: string;
}

export function findPaths(input: {
  genealogyId: string;
  from: string;
  to: string;
  maxDepth?: number;
  maxPaths?: number;
  includeAffinal?: boolean;
}): Promise<FindPathsResponse> {
  return apiFetch<FindPathsResponse>(
    `/api/v1/g/${encodeURIComponent(input.genealogyId)}/queries:findPaths`,
    {
      method: "POST",
      body: JSON.stringify({
        genealogyId: input.genealogyId,
        from: { value: input.from },
        to: { value: input.to },
        maxDepth: input.maxDepth ?? 8,
        maxPaths: input.maxPaths ?? 10,
        includeAffinal: input.includeAffinal ?? false,
      }),
    },
  );
}

export interface NKCAResponse {
  ancestorId?: { value: string };
  ancestorIsUnknown?: boolean;
  totalGenerations?: number;
  combinedCertainty?: Certainty;
  pathFromA?: Path;
  pathFromB?: Path;
  graphVersion?: string;
}

export function nkca(input: {
  genealogyId: string;
  a: string;
  b: string;
}): Promise<NKCAResponse> {
  return apiFetch<NKCAResponse>(
    `/api/v1/g/${encodeURIComponent(input.genealogyId)}/queries:nkca`,
    {
      method: "POST",
      body: JSON.stringify({
        genealogyId: input.genealogyId,
        a: { value: input.a },
        b: { value: input.b },
      }),
    },
  );
}

export function prettyClassification(c?: PathClassification): string {
  if (!c) return "—";
  return c.replace(/^PATH_CLASSIFICATION_/, "").toLowerCase();
}
