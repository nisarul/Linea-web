// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Thin fetch wrapper. All requests are same-origin and rely on
 * the BFF's HttpOnly session cookie for auth — we never read or
 * write tokens from JS.
 */
export class ApiError extends Error {
  constructor(public status: number, message: string, public body?: unknown) {
    super(message);
    this.name = "ApiError";
  }
}

export async function apiFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(path, {
    ...init,
    credentials: "same-origin",
    headers: {
      Accept: "application/json",
      ...(init?.body && !(init.body instanceof FormData)
        ? { "Content-Type": "application/json" }
        : {}),
      ...init?.headers,
    },
  });
  const text = await res.text();
  const body = text ? safeJSON(text) : null;
  if (!res.ok) {
    const msg =
      (body && typeof body === "object" && "message" in body
        ? String((body as Record<string, unknown>).message)
        : "") || res.statusText;
    throw new ApiError(res.status, msg, body);
  }
  return body as T;
}

function safeJSON(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return s;
  }
}
