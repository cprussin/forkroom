# 0003 — Realtime via SSE polling the transactional outbox

**Decision:** Deliver realtime updates with Server-Sent Events. Each connection
streams a chat's events by polling the durable `outbox_events` table for
`id > cursor`, rather than subscribing to an in-process pub/sub or a managed
broker.

**Why:** The deployment target is serverless (Vercel free tier), where
instances are ephemeral and there is no shared in-memory bus between the writer
and the SSE reader. Committed changes already land in a transactional outbox (in
the same transaction as the change), so the outbox *is* the broadcast log.
Polling it by cursor makes delivery:

- **Correct across instances** — any function can serve any connection.
- **Resumable** — a reconnecting client resends its last event id and re-reads
  what it missed; the snapshot-then-subscribe-from-cursor flow avoids a
  load/subscribe race (§7.5).
- **Durable** — the database is authoritative; a briefly-unavailable realtime
  layer loses nothing.

**Trade-offs:** Up to one poll interval (~300 ms) of latency and steady light
query load per open connection — acceptable at MVP scale and within the
performance targets (§13). SSE connections are bounded by the function
`maxDuration`; the browser's `EventSource` reconnects automatically.

**Upgrade path:** Swap the poll loop for `LISTEN/NOTIFY` or a managed pub/sub
behind the same `streamChatEvents` interface without touching the client.
