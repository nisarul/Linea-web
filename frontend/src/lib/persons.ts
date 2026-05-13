// SPDX-License-Identifier: AGPL-3.0-or-later

import { apiFetch } from "./api";

export interface Name {
  text: string;
  language?: string;
  script?: string;
  type?: string;
  preferred?: boolean;
}

export interface TimeRange {
  earliestKnown?: boolean;
  earliestYear?: number;
  latestKnown?: boolean;
  latestYear?: number;
  calendar?: string;
  circa?: boolean;
}

export interface Person {
  id: { value: string };
  unknownAncestor?: boolean;
  names?: Name[];
  gender?: string;
  birth?: TimeRange;
  death?: TimeRange;
  notes?: string;
}

export interface ListPersonsResponse {
  persons?: Person[];
  nextPageToken?: string;
  graphVersion?: string;
}

export function listPersons(genealogyId: string, pageSize = 200): Promise<ListPersonsResponse> {
  return apiFetch<ListPersonsResponse>(
    `/api/v1/g/${encodeURIComponent(genealogyId)}/persons?page_size=${pageSize}`,
  );
}

export function getPerson(
  genealogyId: string,
  personId: string,
): Promise<{ person: Person; graphVersion?: string }> {
  return apiFetch<{ person: Person; graphVersion?: string }>(
    `/api/v1/g/${encodeURIComponent(genealogyId)}/persons/${encodeURIComponent(personId)}`,
  );
}

export function preferredName(p: Person): string {
  if (p.unknownAncestor) return "Unknown ancestor";
  if (!p.names || p.names.length === 0) return p.id.value.slice(0, 8);
  const pref = p.names.find((n) => n.preferred);
  return (pref ?? p.names[0])?.text ?? p.id.value.slice(0, 8);
}

export function lifeRange(p: Person): string {
  const b = yearOf(p.birth);
  const d = yearOf(p.death);
  if (!b && !d) return "";
  return `${b ?? "?"} – ${d ?? "?"}`;
}

function yearOf(t?: TimeRange): string | null {
  if (!t) return null;
  if (t.earliestKnown && t.earliestYear) {
    return (t.circa ? "c. " : "") + String(t.earliestYear);
  }
  if (t.latestKnown && t.latestYear) {
    return "≤" + String(t.latestYear);
  }
  return null;
}
