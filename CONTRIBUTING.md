# Contributing

## Getting set up

1. `npm install` (installs all workspaces)
2. `cp apps/backend/.env.example apps/backend/.env` and adjust if needed
3. Start Postgres: `docker compose up -d postgres`
4. `npm run prisma:migrate --workspace=apps/backend` (creates the schema)
5. `npm run seed --workspace=apps/backend` (loads demo firms/users/models)
6. `npm run dev` (runs backend on :4000 and frontend on :5173)

See [README.md](./README.md) for the full walkthrough and demo login credentials.

## Branching & commits

- Branch off `main`: `git checkout -b feat/short-description`
- Keep commits focused; write imperative-mood messages ("Add rebalance de-minimis check", not "added").
- Open a PR against `main` using the PR template - CI (lint, typecheck, test, build) must pass.

## Code style

- TypeScript everywhere, strict mode on. Don't add `any` without a comment explaining why it's unavoidable.
- Formatting is enforced by Prettier (`npm run format`) and a pre-commit hook (husky + lint-staged) - you shouldn't need to think about it.
- Domain enums, permissions, and cross-cutting validation live in `packages/shared` - if backend and frontend both need a rule (e.g. "allocations must sum to 100%"), it belongs there, not duplicated in both apps.

## Tests

- `packages/shared`: pure-function unit tests (vitest) for validation and the rebalance/money-allocation engines. Any change to those algorithms needs a test that would fail without the fix.
- `apps/backend`: vitest + supertest for routes/middleware. Tests that need a real database are integration tests; keep pure-logic tests DB-free where possible.
- `apps/frontend`: vitest + Testing Library for components.
- Run everything with `npm test` from the repo root.

## Database changes

The schema lives in `apps/backend/prisma/schema.prisma`. After editing it:

```bash
npm run prisma:migrate --workspace=apps/backend -- --name describe_your_change
```

Commit the generated migration folder under `apps/backend/prisma/migrations/`. Update `docs/domain-model.md` if the change affects how a guide concept maps to the schema.

## Adding a new permission or role

1. Add it to `packages/shared/src/enums.ts`.
2. Update the matrix in `packages/shared/src/permissions.ts`.
3. Update `apps/backend/prisma/schema.prisma`'s `Role` enum if it's a new role, then migrate.
4. Reflect it in `docs/domain-model.md`'s permissions table.
