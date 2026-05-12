# Linea Web

The elegant, accessible web client for [Linea](https://github.com/nisarul/Linea-specs).

Two halves shipped as a single deploy unit:

- **`frontend/`** — React + TypeScript SPA built with Vite + Tailwind. Canvas-based tree visualisation (Konva + d3-hierarchy). Three themes (Light / Dark / System) from day one with no flash.
- **`bff/`** — Tiny Go Backend-For-Frontend that handles OIDC, holds tokens server-side, exposes a session cookie to the browser, and proxies API calls to [Linea-server](https://github.com/nisarul/Linea-server).

> Linea — lineage, without assumptions.

## Status

Pre-release. Implements spec v1.1.0 / Linea-server v0.2.0+.

Built in 10 phases (each independently shippable):

1. ✅ Design system foundation
2. App shell + auth + dashboard
3. Genealogy view (read paths)
4. Canvas tree
5. Write paths (proposals)
6. Curator review
7. Genealogy lifecycle
8. Public discovery
9. Polish
10. Hardening (graduates to 1.0.0)

## Aesthetic direction

A blend of:

- **Notion + Things** for warmth on user-facing surfaces (person pages, dashboards).
- **Linear** for cockpit precision (curator review queue, member management, settings).
- **Substack-tier typography** throughout (serif headlines + humanist sans, generous reading widths, proper hierarchy).

## Quick start (dev)

```sh
# Terminal 1: SPA dev server
cd frontend
npm install
npm run dev          # Vite at http://localhost:5173

# Terminal 2: BFF
cd bff
go run ./cmd/lineabff   # listens at http://localhost:8090
```

In dev, Vite proxies API calls to the BFF; the BFF proxies them on to a local
Linea-server. See [docker-compose.dev.yml](./docker-compose.dev.yml) for the full
local stack (Linea-server + Keycloak + Linea-web).

## License

AGPL-3.0-or-later. See [LICENSE](./LICENSE).
The Linea specifications themselves are licensed under CC BY 4.0.
