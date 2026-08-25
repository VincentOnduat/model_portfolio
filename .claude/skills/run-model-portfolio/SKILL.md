---
name: run-model-portfolio
description: Build, run, and drive the Model Portfolio web app (React/Vite frontend + Express/Prisma/Postgres backend). Use when asked to start the app, run the dev servers, take a screenshot of the UI, log in, or interact with the running app (models, client accounts, sharing, money allocation/rebalance).
---

Model Portfolio is a browser-driven web app: a Vite dev server (:5173)
proxying `/api` to an Express API (:4000) backed by Postgres. For
agent/automated use, drive it via the Playwright REPL at
`.claude/skills/run-model-portfolio/driver.mjs` under tmux - headless
Chromium, no xvfb needed (there's no native window to render).

All paths below are relative to the repo root.

## Prerequisites

```bash
sudo apt-get install -y tmux          # for send-keys/capture-pane driving
npx playwright install chromium --with-deps   # browser binary, one-time
```

Docker (for Postgres) and Node >=20 are assumed already available.

## Setup

```bash
npm install                                            # root workspaces
cd .claude/skills/run-model-portfolio && npm install    # driver's own
cd -                                                     # playwright dep -
                                                          # deliberately NOT
                                                          # wired into the
                                                          # app's own package.json
```

## Build

Not required to run the dev servers (`tsx watch` / `vite` compile on the
fly). It IS required before `npm test`/`npm run typecheck`, because
`apps/backend` and `apps/frontend` both import compiled output from
`packages/shared/dist/`:

```bash
npm run build:shared
```

## Run (agent path)

1 - Bring up Postgres and apply migrations (idempotent - safe to skip
migrate/seed if already applied, see Gotchas):

```bash
docker compose up -d postgres
timeout 30 bash -c 'until docker exec model-portfolio-postgres-1 pg_isready -U model_portfolio; do sleep 1; done'
cd apps/backend
npm run prisma:deploy
npm run seed   # ok to fail with P2002 "Unique constraint... (email)" - means already seeded
cd ../..
```

2 - Start the backend and frontend dev servers in the background, each
polled until it actually serves (don't `sleep N` and hope):

```bash
(cd apps/backend && DATABASE_URL="postgresql://model_portfolio:model_portfolio@localhost:5432/model_portfolio?schema=public" \
  JWT_SECRET=dev-only-change-me JWT_EXPIRES_IN=12h CORS_ORIGIN=http://localhost:5173 \
  NODE_ENV=development PORT=4000 npm run dev > /tmp/backend.log 2>&1 &)
timeout 30 bash -c 'until curl -sf http://localhost:4000/health >/dev/null; do sleep 1; done'

(cd apps/frontend && npm run dev > /tmp/frontend.log 2>&1 &)
timeout 30 bash -c 'until curl -sf http://localhost:5173 >/dev/null; do sleep 1; done'
```

3 - Drive it with the REPL driver, wrapped in tmux:

```bash
tmux new-session -d -s app -x 200 -y 50
tmux send-keys -t app 'node .claude/skills/run-model-portfolio/driver.mjs' Enter
timeout 20 bash -c 'until tmux capture-pane -t app -p | grep -q "for commands"; do sleep 0.3; done'
tmux send-keys -t app 'launch' Enter
timeout 20 bash -c 'until tmux capture-pane -t app -p | grep -q "launched"; do sleep 0.3; done'
tmux send-keys -t app 'login owner@northbridge.test Password123!' Enter
timeout 15 bash -c 'until tmux capture-pane -t app -p | grep -q "login ->"; do sleep 0.3; done'
tmux send-keys -t app 'ss dashboard' Enter
tmux capture-pane -t app -p
```

Screenshots land in `/tmp/shots/` (override with `SCREENSHOT_DIR`).
Backend/frontend logs are at `/tmp/backend.log` / `/tmp/frontend.log`.

### Demo accounts (all seeded with password `Password123!`)

| Email | Role |
|---|---|
| `admin@platform.test` | Platform admin |
| `owner@northbridge.test` | Adviser model owner - has a "Balanced Growth" (LIVE) and "Cautious Income" (DRAFT) model |
| `advisor@northbridge.test` | Adviser standard (bespoke sharing grant on Balanced Growth) |
| `owner@aldgate.test` | Third-party model owner |
| `standard@aldgate.test` | Third-party standard |

`owner@northbridge.test`'s seeded "Balanced Growth" model has one client
account attached with holdings deliberately drifted from target - use it
to drive the Money Allocation / Rebalance flow.

### Driver commands

| command | what it does |
|---|---|
| `launch` | open headless Chromium, navigate to the app |
| `login <email> <password>` | fill + submit the login form, wait for a real post-auth marker |
| `nav <path>` | navigate to a path (e.g. `nav /models`) |
| `ss [name]` | screenshot -> `/tmp/shots/<name or timestamp>.png` |
| `click <css-sel>` | click via CSS selector |
| `click-text <text>` | click a button/link/tab by visible text |
| `fill <css-sel> <value>` | fill an input |
| `type <text>` / `press <key>` | keyboard input |
| `wait <css-sel>` | wait for an element to appear, 10s timeout |
| `wait-gone <text>` | wait for a text node to disappear (e.g. a loading state) |
| `eval <js>` | evaluate JS in the page, print JSON |
| `text [css-sel]` | print innerText of an element (or the whole body) |
| `url` | print the current page URL |
| `console` | print captured browser console errors since launch |
| `quit` | close the browser |

## Run (human path)

```bash
npm run dev   # from repo root - starts backend AND frontend together
              # (its script is literally `... --workspace=apps/backend &
              # ... --workspace=apps/frontend`); Ctrl-C stops both.
```

Open http://localhost:5173. Useless in a headless container - use the
agent path above instead.

## Test

```bash
npm run build:shared   # apps import packages/shared/dist, not src
docker compose up -d postgres   # tests need a live DB
npm test
```

Expected: `packages/shared` 11 tests, `apps/backend` 7 tests,
`apps/frontend` 1 test - all passing.

## Gotchas

- **Running `npm run dev` from inside `apps/backend/` or
  `apps/frontend/` only starts that one workspace**, even though the
  *root* `package.json`'s `dev` script name is the same - it's a
  different script (`tsx watch src/server.ts` vs. the root's combined
  `... --workspace=apps/backend & ... --workspace=apps/frontend`). This
  is actually useful for the agent path above (independent readiness
  polling per service, separate log files) but is easy to trip over if
  you expect one `cd X && npm run dev` to bring up everything.

- **Postgres data persists across `docker compose down`** (it's a
  named volume, `model-portfolio_postgres-data`, not removed unless you
  pass `-v`). Re-running `npm run seed` against an already-seeded DB
  fails with `Unique constraint failed on the fields: (email)` (Prisma
  P2002) - that's not a bug, it means the demo data is already there.
  Use `docker compose down -v` only when you actually want a clean
  slate.

- **`page.url()` read right after a login click/submit can still show
  the stale `/login` URL** even though the login itself succeeded - the
  `POST /api/auth/login` XHR settling and React Router's client-side
  redirect are two separate async steps, so `waitForLoadState('networkidle')`
  alone isn't enough. The driver's `login` command instead waits for
  the `Sign out` button (only rendered once authenticated) before
  reporting success - use `wait`/`wait-gone` the same way for your own
  post-action checks rather than trusting `url` immediately after a click.

- **The model detail page shows a transient "Loading model..." state**
  that can still be on screen right after `networkidle` - TanStack
  Query's re-render lags slightly behind the network settling. Use the
  driver's `wait-gone "Loading model..."` before screenshotting a detail
  page.

- **Playwright is intentionally NOT a dependency of the app itself** -
  it lives in its own `package.json`/`node_modules` inside this skill
  directory (`.claude/skills/run-model-portfolio/`), separate from the
  root npm workspace, so driving the app doesn't add a browser-automation
  dependency to the project's real dependency graph.

## Troubleshooting

- **`Cannot find module 'playwright'`**: the driver's dependency isn't
  installed - run `npm install` inside
  `.claude/skills/run-model-portfolio/` (its own `package.json`, not the
  root one).
- **`docker exec ... pg_isready` prints "no response" or "rejecting
  connections" a few times**: normal first-few-seconds startup lag -
  the polling loop in the Run section handles it, don't reduce it to a
  fixed `sleep`.
- **tmux `capture-pane` seems to show a stale `driver>` prompt
  immediately after you `quit` and relaunch in the same pane**: that's
  leftover scrollback from the previous process, not the new one being
  ready - your `grep -q` wait condition can false-positive on it. Kill
  the whole tmux session (`tmux kill-session -t app`) and start a fresh
  one instead of reusing a pane across a quit/relaunch.
- **`npm run typecheck` or `npm test` fails on missing types/exports
  from `@model-portfolio/shared`**: run `npm run build:shared` first -
  both apps resolve that package to its compiled `dist/`, not `src/`.
