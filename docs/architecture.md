# Architecture

forkroom is a single Next.js application plus a background worker, both from one
codebase, over one PostgreSQL database. The database is the source of truth;
everything else is derived or eventually-consistent.

## Boundaries

```
apps/web/src
  contracts/      wire schemas (Zod) shared by server + client: entities, events, snapshot
  server/
    domain/       pure logic — no I/O: authorization matrix, append-vs-fork, ancestry, invites
    repositories/ parameterized SQL, one file per aggregate; every row parsed with Zod
    services/     transactions composing domain + repositories (create-chat, submit-prompt, invites, retry)
    generation/   model provider seam, run-generation, jobs worker
    realtime/     outbox → SSE event stream
    http/         session identity, problem-detail responses, rate limiting
    db/           pool, tx helper, migration runner, auto-init
  client/         reducer, hydrate, SSE hook, composer-mode (pure, reused from domain)
  ui/             React components built on @forkroom/component-library
  app/            App Router pages + route handlers
```

Domain modules import nothing with side effects, so they are unit-tested
without a database and are safely reused on the client (the composer mirrors the
server's fork decision from the same function).

## The prompt transaction

`services/submit-prompt.ts` is the heart of the system. One transaction decides
append vs fork and enqueues generation atomically (PRD §7.4, §7.6):

1. Reject over-long prompts before opening the transaction.
2. `pg_advisory_xact_lock` on `(idempotencyKey, user, chat)` — serializes
   duplicate submissions so a replay returns the first committed result instead
   of doing the work twice.
3. If a `prompt_requests` row already exists for the key → return it (replay).
4. Load membership + the selected branch `FOR UPDATE`.
5. `authorizeSubmission` → `Append` | `Fork` | reject (non-member / creator-off-main).
6. Validate the expected tip equals the branch's current tip → else
   `409 branch_tip_changed`.
7. On append, refuse if the branch already has an active generation
   (`409 generation_in_progress`).
8. Fork path: insert a child branch at the supplied tip.
9. Insert the user message, a queued assistant placeholder, the generation, a
   job, the `prompt_requests` row, and the outbox events.

Concurrency invariants are enforced by the database, not just this code: a
partial unique index allows one active generation per branch, `UNIQUE(branch_id,
sequence_number)` makes the second racing append fail, and composite foreign
keys on `UNIQUE(id, chat_id)` columns force a branch's parent/messages/generation
to share its chat. `mapWriteConflict` translates those unique violations into
the specified 409s.

## Generation lifecycle

`generation/run-generation.ts`, driven by the worker:

```
queued → streaming → completed
                   ↘ failed  (sanitized error_code; user prompt preserved; retryable)
```

It marks the generation streaming, builds model context by walking branch
ancestry to the fork point (`domain/context.ts`) and mapping completed messages
to provider messages, then streams the reply — **checkpointing** accumulated
text to the assistant message every ~300 ms. Each checkpoint is a committed
`message_updated` outbox event, so a missed intermediate delta is repaired by
the next checkpoint. Model failures are persisted as `failed` (never rethrown);
infrastructure failures throw so the worker reschedules with backoff.

Crash recovery is idempotent: a generation left `streaming` by a dead worker is
reclaimed after its job lease expires and re-streamed into the **same** assistant
message — never a second one (PRD §13).

## Realtime delivery

Committed changes are written to an `outbox_events` table in the same
transaction, giving each a monotonic id. Clients load a snapshot (which includes
the current outbox cursor), then open an SSE connection at `?cursor=<id>`. The
stream polls the outbox for `id > cursor` and emits events; the client applies
them through a reducer that is **idempotent** (per-entity version = highest event
id applied) and **order-insensitive** (messages sorted by `sequence_number` at
read time). A detected gap triggers a snapshot refetch.

Polling the durable outbox — rather than an in-process pub/sub — is what makes
delivery correct across serverless instances and resilient to a dropped
connection. See [decisions/0003](./decisions/0003-realtime-sse-outbox-polling.md).

## Deployment topology

- **Web**: the Next.js app. Route handlers and RSC pages run on the Node
  runtime (the `pg` driver is Node-only). The database self-migrates via the
  `instrumentation.ts` hook on first boot.
- **Worker**: `bun run worker` (a long-lived process) or `POST /api/worker/tick`
  (a serverless-friendly cron that drains the queue within one invocation). Many
  workers can run concurrently — `FOR UPDATE SKIP LOCKED` keeps them from
  contending.
- **Database**: one PostgreSQL instance (e.g. Neon). A connection pooler is
  recommended for serverless fan-out.

## Security posture

Server-derived identity on every mutation and subscription; parameterized SQL
only; invitation tokens stored as SHA-256 hashes; membership-scoped reads tested
against IDOR; model/user content rendered as sanitized Markdown with no raw
HTML; secrets server-only; prompts/responses never logged (ids, status, timing,
and sanitized error categories only). Rate limits guard auth, invites, prompts,
and retries. See PRD §12.
