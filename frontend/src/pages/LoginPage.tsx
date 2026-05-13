// SPDX-License-Identifier: AGPL-3.0-or-later

import { useEffect, useState } from "react";
import { Button, Card, CardBody, CardHeader } from "@/components";
import { fetchProviders, type AuthProvider } from "@/lib/auth";

/**
 * LoginPage shows a button per configured OIDC provider.
 * Clicking a button hands off to the BFF's /auth/login/{provider}.
 *
 * If `?return_to=/path` is present in the URL, it is preserved on
 * the underlying redirect so the user lands back where they started.
 */
export function LoginPage() {
  const [providers, setProviders] = useState<AuthProvider[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchProviders()
      .then(setProviders)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  const returnTo = new URLSearchParams(window.location.search).get("return_to") ?? "/";

  return (
    <div className="mx-auto max-w-md py-16">
      <Card>
        <CardHeader>
          <h1 className="font-serif text-2xl tracking-tight">Sign in to Linea</h1>
          <p className="mt-1 text-sm text-(--color-fg-secondary)">
            Choose how you want to sign in.
          </p>
        </CardHeader>
        <CardBody>
          {error && (
            <div className="mb-4 rounded-md border border-(--color-status-danger)/30 bg-(--color-status-danger)/10 px-3 py-2 text-sm">
              Could not load providers: {error}
            </div>
          )}
          {providers === null && !error && (
            <div className="space-y-2">
              <div className="h-10 animate-pulse rounded-md bg-(--color-bg-sunken)" aria-hidden />
              <div className="h-10 animate-pulse rounded-md bg-(--color-bg-sunken)" aria-hidden />
            </div>
          )}
          {providers && providers.length === 0 && (
            <p className="text-sm text-(--color-fg-muted)">
              No identity providers are configured on this server.
            </p>
          )}
          {providers && providers.length > 0 && (
            <div className="flex flex-col gap-2">
              {providers.map((p) => (
                <ProviderButton key={p.name} provider={p} returnTo={returnTo} />
              ))}
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

function ProviderButton({
  provider,
  returnTo,
}: {
  provider: AuthProvider;
  returnTo: string;
}) {
  const href = (() => {
    const u = new URL(provider.loginUrl, window.location.origin);
    if (returnTo) u.searchParams.set("return_to", returnTo);
    return u.toString();
  })();
  return (
    <a href={href} className="block">
      <Button variant="primary" className="w-full">
        Continue with {provider.displayName}
      </Button>
    </a>
  );
}
