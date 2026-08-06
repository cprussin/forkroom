# forkroom

Collaborative branched AI chat. One person creates a chat and invites others;
everyone watches the conversation update in real time. The creator owns an
uninterrupted **main** branch. When any other participant submits a prompt, the
app **forks** a new branch from the exact state they were viewing — their prompt
and the AI's reply land on that branch, main is untouched, and every branch is
shown side by side, live.

This is the MVP described in the product spec: branching that is
understandable, deterministic, durable, and usable by several people at once.

## Tech stack

- **Runtime / package manager:** [Bun](https://bun.sh)
- **Framework:** Next.js (App Router) + TypeScript, React Server Components for
  loading and client components for the live board
- **Lint / format:** [Biome](https://biomejs.dev) (no ESLint/Prettier)
- **Styling:** [Panda CSS](https://panda-css.com) via a shared
  `@forkroom/component-library` preset (no Tailwind, no CSS-in-JS runtime)
- **Database:** PostgreSQL as the source of truth, accessed with the `pg`
  driver and **explicit parameterized SQL — no ORM**
- **Realtime:** Server-Sent Events streamed from a transactional **outbox**
- **AI generation:** a background worker draining a jobs table
  (`FOR UPDATE SKIP LOCKED`); one provider behind a narrow interface (Anthropic,
  plus a dependency-free mock)
- **Auth:** Auth.js (NextAuth v5) with email dev credentials and optional GitHub OAuth

The repository is a Bun + Turborepo monorepo:

| Path | What it is |
|---|---|
| `apps/web` | The Next.js application: UI, API routes, domain logic, worker, migrations |
| `packages/component-library` | Panda CSS component library and design-token preset |
| `packages/test-support` | Shared test setup (happy-dom + Testing Library) |
| `docs/guidelines` | Engineering standards every change follows |
| `docs/architecture.md` | System architecture |
| `docs/decisions` | Architecture decision records |

## Prerequisites

- Bun `>= 1.3.14`
- Node `>= 24` (for the Next.js toolchain)
- A PostgreSQL database (local, or a managed one such as Neon)

## Quick start

```bash
bun install

# From apps/web — create your env file and fill in DATABASE_URL + AUTH_SECRET.
cp .env.example apps/web/.env.local
# generate a secret:  openssl rand -base64 32

cd apps/web
bun run start:dev           # http://localhost:3000
```

The database **initializes itself on first startup** — the server applies any
pending SQL migrations automatically, so there is no manual migrate step. With
`MODEL_PROVIDER=mock` (the default) you need no AI API key: prompts stream a
deterministic reply.

To see the full generation path, run a worker in a second terminal (or hit the
cron endpoint — see below):

```bash
cd apps/web
bun run worker
```

Optionally seed a two-user demo:

```bash
cd apps/web
bun run db:seed            # prints sign-in emails + an invite link
```

Then sign in as `alice@example.com` in one browser and `bob@example.com` in
another (email-only dev credentials), open the printed chat, and try forking.

## Environment variables

See [`.env.example`](./.env.example) for the full list with descriptions. The
essentials:

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | yes | PostgreSQL connection string |
| `AUTH_SECRET` | yes | Signs Auth.js session tokens |
| `MODEL_PROVIDER` | no (`mock`) | `mock` or `anthropic` |
| `MODEL_NAME` | no | Model id for the provider |
| `ANTHROPIC_API_KEY` | if `anthropic` | Provider credential (server-only) |
| `AUTH_GITHUB_ID` / `AUTH_GITHUB_SECRET` | no | Enable GitHub OAuth sign-in |
| `CRON_SECRET` | no | Guards `POST /api/worker/tick` |

## Commands

Run from `apps/web` unless noted.

| Command | What it does |
|---|---|
| `bun run start:dev` | Dev server (auto-migrates on boot) |
| `bun run worker` | Standalone generation worker |
| `bun run build` | Production build |
| `bun run start:prod` | Serve the production build |
| `bun run db:migrate` | Apply migrations explicitly (optional; startup does this) |
| `bun run db:seed` | Seed the two-user demo |
| `bun run db:reset` | **Dev only** — drop and re-create the schema |
| `bun run test:unit` | Unit tests (Bun) — no database needed |
| `bun run test:integration` | Integration tests — needs `DATABASE_URL` |
| `bun run test:e2e` | Playwright end-to-end — needs a running stack |
| `bun run test:types` | Typecheck |

Repo-wide checks (from the root):

```bash
node_modules/.bin/turbo test    # types + unit across packages
bun run test:lint               # Biome
```

## Testing

- **Unit** (`test:unit`) — pure domain logic with no database: the
  append-vs-fork decision, the authorization matrix, deterministic
  ancestry/context construction, invite hashing/validation, and the realtime
  event reducer's dedup / out-of-order handling.
- **Integration** (`test:integration`) — the prompt transaction and
  repositories against a real Postgres: atomic chat creation, fork-doesn't-mutate-main,
  branch-owner continuation, idempotent replay, concurrent-append rejection,
  mock generation, and non-member access denial. Point `DATABASE_URL` at a test
  database.
- **End-to-end** (`test:e2e`) — two isolated browser sessions through the
  creator/participant journey. See [`apps/web/tests/e2e/README.md`](./apps/web/tests/e2e/README.md).

## Architecture

The prompt transaction, realtime delivery, generation lifecycle, and deployment
topology are documented in [`docs/architecture.md`](./docs/architecture.md).
Notable decisions live in [`docs/decisions/`](./docs/decisions).

## Deployment (Vercel + Neon, free tier)

forkroom deploys on entirely free-tier services. In short: **Neon** for
PostgreSQL, **Vercel** for the web app, and either a Vercel Cron or an external
uptime pinger to drive the generation worker.

1. **Database — Neon.** Create a project at [neon.tech](https://neon.tech) and
   copy the pooled connection string into `DATABASE_URL`. The app migrates
   itself on first request; no manual step.
2. **Web — Vercel.** Import the repo, set the project root to `apps/web`, and
   add the environment variables above (`DATABASE_URL`, `AUTH_SECRET`,
   `MODEL_PROVIDER`, and `ANTHROPIC_API_KEY` if using Anthropic). Deploy.
3. **Worker.** Vercel's serverless model has no always-on process, so generation
   is driven by `POST /api/worker/tick`, which drains queued jobs within one
   invocation. Add a Vercel Cron (in `vercel.json`) calling it every minute and
   set `CRON_SECRET`; or run `bun run worker` anywhere with database access for a
   continuous worker.
4. **Realtime.** SSE is delivered by polling the durable outbox by cursor, so it
   works within serverless function limits — connections are bounded by
   `maxDuration` and the browser reconnects and resumes from its last event id.

Full step-by-step deployment instructions are in the pull request description.

## Guidelines

Engineering standards are in [`docs/guidelines/`](./docs/guidelines) and indexed
by [`AGENTS.md`](./AGENTS.md). They are ported from the `argo-browser` project
whose conventions this codebase follows: TDD, offensive error handling,
explicit control flow, Panda-only styling, parse-at-the-boundary data handling,
and parameterized SQL.
