# End-to-end tests

These Playwright specs drive two isolated browser sessions through the
collaborative-branching journey (PRD §15). They run against a **live stack**,
not a mocked one.

## Prerequisites

1. A PostgreSQL database, migrated:
   ```bash
   DATABASE_URL=... bun run db:migrate
   ```
2. The web app running (from `apps/web`):
   ```bash
   MODEL_PROVIDER=mock AUTH_SECRET=dev DATABASE_URL=... bun run start:dev
   ```
   `MODEL_PROVIDER=mock` streams a deterministic reply with no API key.
3. A worker draining generations — either the standalone process:
   ```bash
   MODEL_PROVIDER=mock AUTH_SECRET=dev DATABASE_URL=... bun run worker
   ```
   or a loop hitting `POST /api/worker/tick`.

## Run

```bash
E2E_BASE_URL=http://localhost:3000 bun run test:e2e
```

Chromium is used by default. The specs sign in with the development
email-credentials provider, so no OAuth configuration is required.
