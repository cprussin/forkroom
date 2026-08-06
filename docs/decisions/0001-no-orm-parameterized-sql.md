# 0001 — No ORM; explicit parameterized SQL

**Decision:** Access PostgreSQL with the `pg` driver and hand-written
parameterized SQL. No Prisma/Drizzle/TypeORM/etc.

**Why:** The PRD forbids an ORM (§8, §19), and the branching invariants —
composite same-chat foreign keys, partial unique indexes for one-main-per-chat /
one-creator-per-chat / one-active-generation-per-branch, advisory locks — are
expressed directly in SQL and DDL. An ORM would hide exactly the constraints
this product depends on.

**How:** Migrations are versioned `.sql` files applied by a small Bun runner
(`db/migrate.ts`), idempotent and tracked in `schema_migrations`. Repositories
issue parameterized queries and parse every row through a Zod schema, so SQL
results are typed at the boundary (per `docs/guidelines/DATA.md`). Values are
never concatenated into SQL.

**Consequences:** We own our schema evolution and every query. Row shapes are
validated at runtime rather than trusted from a generated client.
