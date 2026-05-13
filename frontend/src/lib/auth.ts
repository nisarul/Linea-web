// SPDX-License-Identifier: AGPL-3.0-or-later

import { apiFetch } from "./api";

export interface Me {
  authenticated: boolean;
  provider?: string;
  subject?: string;
  email?: string;
  name?: string;
}

export interface AuthProvider {
  name: string;
  displayName: string;
  loginUrl: string;
}

export function fetchMe(): Promise<Me> {
  return apiFetch<Me>("/auth/me");
}

export function fetchProviders(): Promise<AuthProvider[]> {
  return apiFetch<AuthProvider[]>("/auth/providers");
}

/**
 * Navigates to the in-app login picker page so the user can choose
 * an identity provider. The picker page in turn forwards to the
 * BFF's /auth/login/{provider} for the chosen provider.
 */
export function login(returnTo?: string): void {
  const url = new URL("/login", window.location.origin);
  if (returnTo) url.searchParams.set("return_to", returnTo);
  window.location.href = url.toString();
}

export async function logout(): Promise<void> {
  await apiFetch<void>("/auth/logout", { method: "POST" });
  window.location.href = "/";
}
