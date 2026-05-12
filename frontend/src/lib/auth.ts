// SPDX-License-Identifier: AGPL-3.0-or-later

import { apiFetch } from "./api";

export interface Me {
  authenticated: boolean;
  subject?: string;
  email?: string;
  name?: string;
}

export function fetchMe(): Promise<Me> {
  return apiFetch<Me>("/auth/me");
}

/** Redirects the browser to the BFF login flow. */
export function login(returnTo?: string): void {
  const url = new URL("/auth/login", window.location.origin);
  if (returnTo) url.searchParams.set("return_to", returnTo);
  window.location.href = url.toString();
}

export async function logout(): Promise<void> {
  await apiFetch<void>("/auth/logout", { method: "POST" });
  window.location.href = "/";
}
