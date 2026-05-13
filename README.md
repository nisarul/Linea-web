# Linea Web

The elegant, accessible web client for [Linea](https://github.com/nisarul/Linea-specs) —
a genealogical knowledge graph that records evidence with explicit certainty, gaps with
explicit size, and identity with auditable history.

> Linea — lineage, without assumptions.

Two halves shipped as a single deploy unit:

- **`frontend/`** — React 19 + TypeScript SPA built with Vite + Tailwind 4. Canvas-based
  lineage visualisation (Konva + d3-hierarchy). TanStack Router (type-safe routes) +
  TanStack Query. Three first-class themes (Light / Dark / System) with no flash on load.
- **`bff/`** — Tiny Go Backend-For-Frontend. Handles OIDC Authorization Code + PKCE,
  holds tokens server-side in a Badger-backed session store, exposes only an HttpOnly
  session cookie to the browser, and reverse-proxies API calls to
  [Linea-server](https://github.com/nisarul/Linea-server).

## Status — v1.0.0

Implements the full read + write surface of spec v1.1.0 against Linea-server v0.2.0+.

| Phase | Feature | Status |
|------:|---------|:------:|
| 1 | Design system, theming, no-flash boot | ✅ |
| 2 | App shell, OIDC auth, API proxy | ✅ |
| 3 | Genealogy CRUD + member management | ✅ |
| 4 | Persons, person detail, lineage tree canvas | ✅ |
| 5 | Proposals (submit, list, curator review, bulk reject) | ✅ |
| 6 | Queries (FindPaths, NKCA) | ✅ |
| 7 | Public discovery (signed-out browsing) | ✅ |
| 8–9 | Polish, error boundary, 404 page | ✅ |
| 10 | Hardening (unit tests, bundle budget, CI) | ✅ |

## Aesthetic direction

A blend of:

- **Notion + Things** for warmth on user surfaces (person pages, dashboards).
- **Linear** for cockpit precision (curator queue, member management, queries).
- **Substack-tier typography** throughout (serif headlines + humanist sans, generous
  reading widths, proper hierarchy, OKLCH-based palette).

## Bundle budget

Entry JS gzip stays under **220 kB**; per-chunk gzip under **260 kB**. The lineage tree
(Konva + d3-hierarchy, ~300 kB raw) is lazy-loaded so the dashboard ships ~183 kB gzip.

CI enforces the budget via `npm run size` after every build.

## Quick start (dev)

### Full stack with Keycloak (recommended)

```sh
docker compose -f docker-compose.dev.yml up --build
```

This brings up Keycloak (`:8081`), Linea-server (`:8080`), and Linea-web (`:8090`)
with a seeded `alice / alice` user. Visit <http://localhost:8090>.

### Frontend-only iteration

```sh
# Terminal 1
cd frontend
npm install
npm run dev          # Vite at http://localhost:5173

# Terminal 2
cd bff
go run ./cmd/lineabff
```

Vite proxies `/api` and `/auth` to the BFF.

## Available scripts

```sh
# Frontend
npm run dev          # Vite dev server
npm run build        # TypeScript + Vite production build
npm run lint         # ESLint flat config
npm run test         # Vitest unit tests (18 tests across 4 files)
npm run size         # Enforce bundle-size budget on dist/

# BFF
go build ./...
go test ./...
```

## License

AGPL-3.0-or-later. See [LICENSE](./LICENSE).
The Linea specifications themselves are licensed under CC BY 4.0.
