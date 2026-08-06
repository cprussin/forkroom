# @forkroom/web

The forkroom application: the Next.js web app, its API, the domain and data
layers, the generation worker, and the SQL migrations. See the
[root README](../../README.md) for the product overview and
[docs/architecture.md](../../docs/architecture.md) for how it fits together.

## Layout

```
migrations/            versioned .sql (auto-applied on startup)
src/
  app/                 App Router pages + route handlers (the API surface)
  contracts/           Zod wire schemas shared with the client
  client/              reducer, snapshot hydration, SSE hook, composer-mode
  ui/                  React components (built on @forkroom/component-library)
  server/
    domain/            pure logic (authorization, branching, ancestry, invites)
    repositories/      parameterized SQL, Zod-parsed rows
    services/          transactions (create-chat, submit-prompt, invites, retry)
    generation/        model provider seam, run-generation, worker
    realtime/          outbox → SSE stream
    http/              session identity, problem responses, rate limiting
    db/                pool, tx helper, migrations, auto-init
  instrumentation.ts   applies migrations on server boot
tests/
  integration/         service + repository tests against a real Postgres
  e2e/                 Playwright, two-session journey
```

## Running

```bash
bun run start:dev     # dev server; migrates the database on first boot
bun run worker        # standalone generation worker
bun run db:seed       # two-user demo (prints sign-in + invite link)
```

Set `DATABASE_URL` and `AUTH_SECRET` (see [`.env.example`](../../.env.example)).
`MODEL_PROVIDER=mock` (default) needs no AI key.

## Testing

```bash
bun run test:unit                        # pure logic, no database
DATABASE_URL=... bun run test:integration # transaction + repositories
bun run test:types                       # tsc
```

The API surface (route → purpose):

| Route | Purpose |
|---|---|
| `POST /api/chats` | Create a chat (creator + main branch) |
| `GET /api/chats/:id` | Normalized snapshot + event cursor |
| `POST /api/chats/:id/prompts` | Submit a prompt (server decides append vs fork) |
| `GET /api/chats/:id/events` | Authorized SSE stream (resume via `?cursor=`) |
| `POST /api/chats/:id/invites` | Creator creates an invite |
| `DELETE /api/chats/:id/invites/:inviteId` | Creator revokes an invite |
| `GET /api/invites/:token` | Minimal invite preview |
| `POST /api/invites/:token/accept` | Accept an invite (idempotent) |
| `POST /api/chats/:id/generations/:genId/retry` | Retry a failed generation |
| `POST` \| `GET /api/worker/tick` | Drain generation jobs (cron) |
| `GET /api/health` | Liveness + database check |
