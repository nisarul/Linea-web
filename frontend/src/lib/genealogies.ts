// SPDX-License-Identifier: AGPL-3.0-or-later

import { apiFetch } from "./api";

/** Wire-format Genealogy from Linea-server (camelCased by grpc-gateway). */
export interface Genealogy {
  id: string;
  name: string;
  visibility: "VISIBILITY_PRIVATE" | "VISIBILITY_UNLISTED" | "VISIBILITY_PUBLIC" | "VISIBILITY_UNSPECIFIED";
  createdBy: string;
  createdAt: string;
  myRole:
    | "GENEALOGY_ROLE_OWNER"
    | "GENEALOGY_ROLE_CURATOR"
    | "GENEALOGY_ROLE_CONTRIBUTOR"
    | "GENEALOGY_ROLE_VIEWER"
    | "GENEALOGY_ROLE_NONE"
    | "GENEALOGY_ROLE_UNSPECIFIED";
}

export interface ListGenealogiesResponse {
  genealogies?: Genealogy[];
  nextPageToken?: string;
}

export function listGenealogies(): Promise<ListGenealogiesResponse> {
  return apiFetch<ListGenealogiesResponse>("/api/v1/genealogies");
}
