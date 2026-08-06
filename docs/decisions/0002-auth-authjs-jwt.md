# 0002 — Auth.js with JWT sessions

**Decision:** Use Auth.js (NextAuth v5) with JWT sessions (no database adapter).
Two providers: email-only **dev credentials** for low-friction local testing,
and **GitHub OAuth** for production when configured.

**Why:** The PRD wants a maintained Next.js-compatible auth solution with a
low-friction local method and a production-ready OAuth/email path (§7.1). JWT
sessions avoid an adapter and its extra tables, keeping the schema focused on the
chat domain. We still keep our own `users` table (the chat rows reference it):
each sign-in upserts the user and pins our id onto the token's `sub` claim.

**Why not a DB adapter:** It would add `accounts`/`sessions`/`verification`
tables we don't otherwise need. Identity is small and derivable on each request.

**Consequences:** Every server mutation and the realtime subscription derive the
user id from the session (`http/session-user.ts`), never from client input.
CSRF is covered by Auth.js's same-site session cookies; state-changing routes
are POST/DELETE with those cookies.
