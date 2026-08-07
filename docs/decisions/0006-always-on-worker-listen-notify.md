# 0006 — Always-on worker with LISTEN/NOTIFY pickup

**Decision:** Run the generation worker as a long-lived process (deployed to
Fly.io) that parks on a Postgres `LISTEN` and wakes on an enqueue `NOTIFY`,
rather than relying on the serverless `/api/worker/tick` cron. A periodic poll
remains as a fallback.

**Why:** The dominant latency in an agent response was never token transport —
it was *job pickup*. On Vercel there is no always-on process, so generation only
started when an external minute-cron pinged `/api/worker/tick`: up to ~60 s
between submitting a prompt and the first token. The streaming path
(checkpoint + outbox poll) adds only a few hundred ms on top.

An always-on worker removes the cron entirely. Making its idle wait event-driven
removes the rest of the pickup delay: `enqueueGenerationJob` issues
`pg_notify('generation_jobs')` inside the submit transaction, so the
notification is delivered on COMMIT — exactly when the job row becomes visible —
and a worker parked on that channel claims it immediately. This is the
`LISTEN/NOTIFY` upgrade path that [decision 0003](./0003-realtime-sse-outbox-polling.md)
anticipated, applied to the queue rather than to realtime delivery.

**How:**

- `notifyJobAvailable` fires on enqueue and on requeue (immediate retry), but
  **not** on reschedule — a backed-off job is available only in the future, and
  the fallback poll covers that later wakeup.
- `createJobWakeup` is a pure, single-consumer latch: `wait` resolves on the
  next notification, immediately if one arrived since the previous `wait` (so a
  notification delivered while a job was processing is never lost), after the
  fallback interval, or on abort. `listenForJobs` is the thin Postgres glue that
  feeds it from a dedicated `LISTEN` connection.
- `runWorkerLoop` drains consecutive jobs back-to-back and only parks on the
  wakeup when the queue is empty.

**Trade-offs / consequences:**

- The worker needs a **session** (direct, non-transaction-pooled) `DATABASE_URL`
  — `LISTEN` does not survive a transaction pooler. If notifications never
  arrive (misconfiguration), the worker still drains at the fallback poll
  interval: degraded latency, never stuck.
- One more deploy unit (a Fly app). The serverless cron path is unchanged and
  still works as a fallback for hosts without a Fly worker.
- Considered and rejected: routing generation through argo's agent-host over a
  WebSocket. It hardcodes argo's system prompt, has no client auth, and would
  not by itself fix pickup latency (a process still has to run the job) — more
  code across two repos for no additional speed.
