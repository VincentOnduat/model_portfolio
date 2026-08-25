11# Model Portfolio

A model-portfolio management platform: create investment models, allocate
assets to a target percentage, attach client accounts, share models across
firms/teams with fine-grained permissions, and generate Money Allocation /
Rebalance buy-and-sell orders against those models.

This repo is a from-scratch scaffold built to the same domain shape as an
internal *Model Portfolio User Guide* (advisers/DFMs managing models for
their clients) - see [`docs/domain-model.md`](./docs/domain-model.md) for the
detailed mapping from guide section to code, and
[`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) for how the pieces fit
together.

## What's implemented

- **Model Management** (create, edit, lock/unlock, delete, asset allocation
  with the "must sum to 100%" rule, Draft -> Live publishing) - fully working
  end to end, backend and frontend.
- **Client Accounts**: list/search/attach/detach to a model.
- **Sharing**: Firm / Enterprise / Third-Party permission grants (read +
  create/revoke; org-hierarchy and contract-based restrictions are stubbed -
  see `docs/domain-model.md`).
- **Money Allocation / Rebalance**: the actual calculation engines from the
  guide (an 11-step rebalance algorithm, and buy-only money allocation),
  plus the 3-step Select Accounts -> Generate Orders -> Confirm Orders
  workflow, wired end to end against seeded demo data.
- Role-based access control across six user roles, JWT auth, and a Postgres
  schema covering the full domain (see `apps/backend/prisma/schema.prisma`).

## Tech stack

TypeScript everywhere. React + Vite + Tailwind + TanStack Query on the
frontend; Express + Prisma + PostgreSQL on the backend; a shared package for
types/enums/validation/business-logic used by both. See
[`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md).

## Quick start

### Option A: Docker Compose (closest to production)

```bash
cp .env.example .env
docker compose up --build
# Frontend: http://localhost:8080
# Backend:  http://localhost:4000
```

You'll still need to run migrations + seed once against the containerised
database the first time:

```bash
docker compose exec backend npx prisma migrate deploy
docker compose exec backend npm run seed
```

### Option B: Local dev (faster iteration)

```bash
npm install
cp apps/backend/.env.example apps/backend/.env

docker compose up -d postgres         # just the database
npm run prisma:migrate --workspace=apps/backend
npm run seed --workspace=apps/backend

npm run dev                            # backend on :4000, frontend on :5173
```

Open http://localhost:5173.

### Demo logins

All seeded users share the password `Password123!`:

| Email | Role |
|---|---|
| `admin@platform.test` | Platform admin |
| `owner@northbridge.test` | Adviser model owner |
| `advisor@northbridge.test` | Adviser standard (has a bespoke sharing grant on the seeded model) |
| `owner@aldgate.test` | Third-party model owner |
| `standard@aldgate.test` | Third-party standard |

The seed also creates a "Balanced Growth" model with one client account
whose holdings are deliberately drifted from the model's target allocation -
use it to try Money Allocation / Rebalance -> Create New List -> Rebalance
end to end.

## Common scripts

Run from the repo root (they fan out to the relevant workspace):

```bash
npm run dev          # backend + frontend, watch mode
npm run build        # build shared, backend, frontend in order
npm run lint          # eslint, both apps
npm run typecheck     # tsc, shared + both apps
npm test              # vitest, shared + both apps
npm run format         # prettier --write .
```

Backend-specific (Prisma):

```bash
npm run prisma:migrate --workspace=apps/backend   # create/apply a migration
npm run prisma:studio  --workspace=apps/backend   # browse the DB
npm run seed            --workspace=apps/backend   # reseed demo data
```

## Repository layout

See [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) for the full picture;
in short: `apps/backend`, `apps/frontend`, `packages/shared`, `docs/`.

## Contributing

See [`CONTRIBUTING.md`](./CONTRIBUTING.md) for branching conventions, test
expectations, and how to add a new role/permission.

## Pushing this to GitHub

This repo was scaffolded with git already initialized locally. To push it to
an existing empty GitHub repository:

```bash
git remote add origin https://github.com/VincentOnduat/model_portfolio.git
git branch -M main
git push -u origin main
```

(If a remote named `origin` already exists, use `git remote set-url origin
<url>` instead of `add`.) CI (`.github/workflows/ci.yml`) will run
lint/typecheck/test/build against a Postgres service container on every push
and pull request once it's on GitHub.

## License

Proprietary - all rights reserved. See [`LICENSE`](./LICENSE).
