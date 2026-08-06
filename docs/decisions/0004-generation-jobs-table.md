# 0004 — Database-backed generation jobs

**Decision:** Run AI generation as background jobs in a `generation_jobs` table,
claimed with `SELECT … FOR UPDATE SKIP LOCKED`. No external queue.

**Why:** The PRD asks for the smallest infrastructure that gives durable jobs
(§8, §19). A jobs table reuses the one database we already have. `FOR UPDATE
SKIP LOCKED` lets many workers poll the same queue without contending — each
locks a distinct row and skips rows a peer holds.

**How:** The prompt transaction enqueues a job alongside the generation. A
worker (`bun run worker`) or the `/api/worker/tick` cron claims a job, runs the
generation, and completes it. Claims take a lease (`locked_at`); a crashed
worker's job becomes reclaimable once the lease expires, and re-running is
idempotent because the assistant message is overwritten, never duplicated (§13).
Model failures leave the generation `failed` and retryable; infrastructure
failures reschedule the job with exponential backoff.

**Consequences:** Two ways to run the worker — a long-lived process, or a
serverless cron draining within one invocation — from the same code, matching
whatever the host supports.
