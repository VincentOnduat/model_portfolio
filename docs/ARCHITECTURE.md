# Architecture

## Overview

```
model-portfolio/
├── apps/
│   ├── backend/     Express + TypeScript API, Prisma/PostgreSQL
│   └── frontend/    React + Vite + TypeScript SPA
├── packages/
│   └── shared/      Types, enums, RBAC matrix, and pure domain logic
│                     (validation, rebalance/money-allocation engines)
│                     used by BOTH apps - the single source of truth
│                     for anything that must not drift between them.
└── docs/            This file, domain-model.md, and anything else
                      that documents the "why", not just the "how".
```

It's an npm-workspaces monorepo: one `package.json` at the root defines the
workspace, each app/package has its own with its own dependencies and
scripts, and `packages/shared` is depended on by both apps via
`"@model-portfolio/shared": "*"` (resolved to the local workspace package,
not npm).

## Why a shared package instead of duplicating types?

The guide's business rules (allocation must sum to 100%, the 11-step
rebalance algorithm, the role/permission matrix) need to produce *identical*
answers whether they're enforced by the API (authoritative) or previewed by
the UI (fast feedback before a round-trip). Keeping them in one
TypeScript package that both apps import means there's exactly one place to
fix a bug in, and the frontend can never quietly drift out of sync with
what the backend actually enforces.

## Backend

- **Express** for HTTP, kept intentionally thin - route files parse/validate
  input (Zod) and call a service function; almost no business logic lives in
  route handlers themselves (see `src/routes/*.routes.ts` vs.
  `src/services/*.service.ts`).
- **Prisma** as the ORM/migration tool against **PostgreSQL**. The schema
  (`prisma/schema.prisma`) is the single source of truth for the DB shape;
  see `docs/domain-model.md` for how it maps to the guide.
- **Auth**: stateless JWT (`Authorization: Bearer <token>`), issued by
  `POST /api/auth/login`, verified by `middleware/auth.ts#requireAuth`. No
  sessions/cookies - this keeps the API easy to call from tools other than
  the bundled frontend.
- **RBAC**: a static role -> permission matrix (`packages/shared`) checked by
  `requirePermission(...)` middleware, layered with per-model overrides
  (`SharingGrant` rows) checked inside service functions for anything that
  depends on *which* model, not just the caller's role.
- **Errors**: a single `ApiException` class + `errorHandler` middleware
  produces a consistent `{ error, message, details? }` JSON body
  (`packages/shared/src/types.ts#ApiError`) for every failure.

## Frontend

- **Vite + React + TypeScript**, no meta-framework - this is a single API-
  backed SPA, not a site that needs SSR/SSG.
- **TanStack Query** for all server state (fetching, caching, mutations) -
  there's no separate global store; component state is `useState` for
  purely local/UI concerns (draft form values, selected checkboxes) and
  Query for anything that came from or is going to the API.
- **Tailwind CSS** for styling - utility classes directly in components,
  no separate CSS files per component.
- **React Router** for client-side routing, with a single `ProtectedRoute`
  gate that redirects to `/login` when there's no authenticated user.

## Data flow example: publishing a model

1. `AssetsTab.tsx` calls `validateModelAllocation` (shared) on every keystroke
   to enable/disable the Publish button and show the running total - no
   network call needed for this feedback.
2. On click, `POST /api/models/:id/publish` hits
   `models.routes.ts` -> `models.service.ts#publishModel`, which re-runs the
   *exact same* `validateModelAllocation` function server-side before
   touching the database - the frontend check is a UX nicety, not the
   enforcement point.
3. Prisma updates `Model.status` to `LIVE` inside the request; the response
   is the fresh `ModelDetail`, which TanStack Query writes back into the
   `['model', id]` cache so the UI updates without a manual refetch.

## Testing strategy

- `packages/shared`: unit tests for pure functions (no mocking needed - that's
  the point of keeping them pure).
- `apps/backend`: vitest + supertest against the real Express app
  (`createApp()`), covering auth/RBAC behavior without needing a live
  database for those specific tests; DB-touching tests run in CI against a
  real Postgres service container (see `.github/workflows/ci.yml`).
- `apps/frontend`: vitest + Testing Library for component-level behavior.

## Infrastructure

`docker-compose.yml` runs three services - `postgres`, `backend`, `frontend`
(nginx serving the built SPA and proxying `/api` to `backend`) - for a
one-command local environment that mirrors how you'd actually deploy it
(each app is an independent container). For day-to-day development, running
`postgres` via Docker and the two apps via `npm run dev` (with Vite's dev
server proxy) gives faster iteration than rebuilding containers.
